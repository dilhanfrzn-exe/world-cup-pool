"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getServerSupabase } from "./supabase/server";
import { getCurrentUser, isPoolAdmin } from "./auth";
import { getPoolByCode } from "./data";
import { generateRoomCode } from "./utils";
import { DEFAULT_SCORING_RULES } from "./scoring";
import { WORLD_CUP_TEAMS, flagEmoji } from "./teams";
import { runDraw, DrawError, type DrawableTeam } from "./draw";
import type {
  ActionState,
  DrawType,
  KnockoutStage,
  PayoutStructure,
  Player,
  Pool,
  Trade,
  TradeItem,
} from "./types";

const ok = (success?: string): ActionState => ({ success });
const fail = (error: string): ActionState => ({ error });

function str(formData: FormData, key: string): string {
  return (formData.get(key)?.toString() ?? "").trim();
}
function num(formData: FormData, key: string): number {
  const n = Number(formData.get(key));
  return Number.isFinite(n) ? n : 0;
}
function strList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .map((v) => v.toString().trim())
    .filter(Boolean);
}

function revalidateRoom(code: string) {
  for (const sub of ["", "/results", "/standings", "/admin", "/trade"]) {
    revalidatePath(`/room/${code.toUpperCase()}${sub}`);
  }
}

/**
 * Verify the current logged-in user is the host of this pool (creator) or a
 * super-admin. Returns the pool or throws.
 */
async function assertHost(poolId: string): Promise<Pool> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pools")
    .select("*")
    .eq("id", poolId)
    .maybeSingle();
  if (error) throw error;
  const pool = data as Pool | null;
  if (!pool) throw new Error("Pool not found.");

  const user = await getCurrentUser();
  if (!user) throw new Error("Please log in.");
  if (!isPoolAdmin(pool, user)) {
    throw new Error("You are not the host of this pool.");
  }
  return pool;
}

// ---------------------------------------------------------------------------
// Create pool
// ---------------------------------------------------------------------------
export async function createPoolAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const name = str(formData, "name");
  const buyIn = num(formData, "buy_in");
  const numPlayers = num(formData, "num_players");
  const drawType = str(formData, "draw_type") as DrawType;
  const payout = str(formData, "payout_structure") as PayoutStructure;

  if (!name) return fail("Please enter a pool name.");
  if (buyIn < 0) return fail("Buy-in can't be negative.");
  if (!["random", "tiered", "auction"].includes(drawType))
    return fail("Pick a valid draw type.");
  if (!["winner_take_all", "top_3"].includes(payout))
    return fail("Pick a valid payout structure.");

  const user = await getCurrentUser();
  if (!user) return fail("Please log in to create a pool.");

  const supabase = getServerSupabase();

  // Generate a unique room code (retry on the rare collision).
  let code = generateRoomCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getPoolByCode(code);
    if (!existing) break;
    code = generateRoomCode();
  }

  const { data, error } = await supabase
    .from("pools")
    .insert({
      name,
      buy_in: buyIn,
      num_players: numPlayers,
      draw_type: drawType,
      payout_structure: payout,
      room_code: code,
      created_by: user.id,
    })
    .select("*")
    .single();

  if (error) return fail(error.message);
  const pool = data as Pool;

  // Seed default scoring rules for this pool.
  const { error: rulesError } = await supabase.from("scoring_rules").insert(
    DEFAULT_SCORING_RULES.map((r) => ({
      pool_id: pool.id,
      rule_key: r.key,
      points: r.points,
    })),
  );
  if (rulesError) return fail(rulesError.message);

  // The creator is the host (pool.created_by); no token needed.
  redirect(`/room/${pool.room_code}`);
}

// ---------------------------------------------------------------------------
// Join pool (logged-in friend links their account to a player)
// ---------------------------------------------------------------------------
export async function joinPoolAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = str(formData, "room_code").toUpperCase();
  const name = str(formData, "name");
  const nickname = str(formData, "nickname");

  if (!name) return fail("Enter your name to join.");

  const user = await getCurrentUser();
  if (!user) return fail("Please log in to join this pool.");

  const pool = await getPoolByCode(code);
  if (!pool) return fail("No pool found for that room code.");

  const supabase = getServerSupabase();

  // One player per user per pool.
  const { data: existing } = await supabase
    .from("players")
    .select("id")
    .eq("pool_id", pool.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) return ok("You're already in this pool.");

  const { error } = await supabase.from("players").insert({
    pool_id: pool.id,
    user_id: user.id,
    name,
    nickname: nickname || null,
  });
  if (error) return fail(error.message);

  revalidateRoom(code);
  return ok(`Welcome, ${name}! You're in the pool.`);
}

// ---------------------------------------------------------------------------
// Admin: add / remove players
// ---------------------------------------------------------------------------
export async function addPlayerAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const poolId = str(formData, "pool_id");
  const code = str(formData, "room_code");
  const name = str(formData, "name");
  const nickname = str(formData, "nickname");
  if (!name) return fail("Enter a player name.");

  try {
    await assertHost(poolId);
  } catch (e) {
    return fail((e as Error).message);
  }

  const supabase = getServerSupabase();
  const { error } = await supabase.from("players").insert({
    pool_id: poolId,
    name,
    nickname: nickname || null,
  });
  if (error) return fail(error.message);
  revalidateRoom(code);
  return ok(`Added ${name}.`);
}

export async function removePlayerAction(formData: FormData): Promise<void> {
  const poolId = str(formData, "pool_id");
  const code = str(formData, "room_code");
  const playerId = str(formData, "player_id");
  await assertHost(poolId);
  const supabase = getServerSupabase();
  const { error } = await supabase.from("players").delete().eq("id", playerId);
  if (error) throw error;
  revalidateRoom(code);
}

// ---------------------------------------------------------------------------
// Admin: teams
// ---------------------------------------------------------------------------
export async function seedTeamsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const poolId = str(formData, "pool_id");
  const code = str(formData, "room_code");
  try {
    await assertHost(poolId);
  } catch (e) {
    return fail((e as Error).message);
  }

  const supabase = getServerSupabase();
  const rows = WORLD_CUP_TEAMS.map((t) => ({
    pool_id: poolId,
    name: t.name,
    country_code: t.code,
    tier: t.tier,
    flag: t.flag ?? flagEmoji(t.code),
  }));
  // Ignore duplicates so re-seeding is safe.
  const { error } = await supabase
    .from("teams")
    .upsert(rows, { onConflict: "pool_id,name", ignoreDuplicates: true });
  if (error) return fail(error.message);
  revalidateRoom(code);
  return ok("Loaded the 48 World Cup teams.");
}

/**
 * Reset a pool's teams to the official 48. Deleting teams cascades to
 * team_assignments and team_results, so any existing draw/results are wiped and
 * the pool returns to "open". Useful for refreshing pools seeded with the old
 * placeholder list.
 */
export async function resetTeamsAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const poolId = str(formData, "pool_id");
  const code = str(formData, "room_code");
  try {
    await assertHost(poolId);
  } catch (e) {
    return fail((e as Error).message);
  }

  const supabase = getServerSupabase();
  const { error: delError } = await supabase
    .from("teams")
    .delete()
    .eq("pool_id", poolId);
  if (delError) return fail(delError.message);

  const rows = WORLD_CUP_TEAMS.map((t) => ({
    pool_id: poolId,
    name: t.name,
    country_code: t.code,
    tier: t.tier,
    flag: t.flag ?? flagEmoji(t.code),
  }));
  const { error } = await supabase.from("teams").insert(rows);
  if (error) return fail(error.message);

  await supabase.from("pools").update({ status: "open" }).eq("id", poolId);
  revalidateRoom(code);
  return ok("Teams reset to the official 48. Any previous draw was cleared — run the draw again.");
}

export async function addTeamAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const poolId = str(formData, "pool_id");
  const code = str(formData, "room_code");
  const name = str(formData, "name");
  const countryCode = str(formData, "country_code");
  const tier = num(formData, "tier") || 1;
  const flag = str(formData, "flag");
  if (!name) return fail("Enter a team name.");

  try {
    await assertHost(poolId);
  } catch (e) {
    return fail((e as Error).message);
  }

  const supabase = getServerSupabase();
  const { error } = await supabase.from("teams").insert({
    pool_id: poolId,
    name,
    country_code: countryCode || null,
    tier,
    flag: flag || (countryCode ? flagEmoji(countryCode) : null),
  });
  if (error) return fail(error.message);
  revalidateRoom(code);
  return ok(`Added ${name}.`);
}

export async function removeTeamAction(formData: FormData): Promise<void> {
  const poolId = str(formData, "pool_id");
  const code = str(formData, "room_code");
  const teamId = str(formData, "team_id");
  await assertHost(poolId);
  const supabase = getServerSupabase();
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) throw error;
  revalidateRoom(code);
}

// ---------------------------------------------------------------------------
// Admin: run / clear the draw
// ---------------------------------------------------------------------------
export async function runDrawAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const poolId = str(formData, "pool_id");
  const code = str(formData, "room_code");

  let pool: Pool;
  try {
    pool = await assertHost(poolId);
  } catch (e) {
    return fail((e as Error).message);
  }

  const supabase = getServerSupabase();
  const [{ data: players }, { data: teams }] = await Promise.all([
    supabase.from("players").select("id").eq("pool_id", poolId),
    supabase.from("teams").select("id, tier").eq("pool_id", poolId),
  ]);

  const playerIds = (players ?? []).map((p) => p.id as string);
  const drawTeams: DrawableTeam[] = (teams ?? []).map((t) => ({
    id: t.id as string,
    tier: t.tier as number,
  }));

  let assignments;
  try {
    assignments = runDraw(pool.draw_type, drawTeams, playerIds);
  } catch (e) {
    if (e instanceof DrawError) return fail(e.message);
    return fail((e as Error).message);
  }

  // Replace any previous draw.
  await supabase.from("team_assignments").delete().eq("pool_id", poolId);
  const { error } = await supabase.from("team_assignments").insert(
    assignments.map((a) => ({
      pool_id: poolId,
      team_id: a.teamId,
      player_id: a.playerId,
    })),
  );
  if (error) return fail(error.message);

  await supabase.from("pools").update({ status: "drawn" }).eq("id", poolId);
  revalidateRoom(code);
  redirect(`/room/${code.toUpperCase()}/results`);
}

export async function clearDrawAction(formData: FormData): Promise<void> {
  const poolId = str(formData, "pool_id");
  const code = str(formData, "room_code");
  await assertHost(poolId);
  const supabase = getServerSupabase();
  await supabase.from("team_assignments").delete().eq("pool_id", poolId);
  await supabase.from("pools").update({ status: "open" }).eq("id", poolId);
  revalidateRoom(code);
}

// ---------------------------------------------------------------------------
// Admin: results + payments
// ---------------------------------------------------------------------------
export async function updateResultAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const poolId = str(formData, "pool_id");
  const code = str(formData, "room_code");
  const teamId = str(formData, "team_id");
  const knockout = str(formData, "knockout_stage") as KnockoutStage;

  try {
    await assertHost(poolId);
  } catch (e) {
    return fail((e as Error).message);
  }

  const supabase = getServerSupabase();
  const { error } = await supabase.from("team_results").upsert(
    {
      pool_id: poolId,
      team_id: teamId,
      group_wins: Math.max(0, num(formData, "group_wins")),
      group_draws: Math.max(0, num(formData, "group_draws")),
      group_losses: Math.max(0, num(formData, "group_losses")),
      knockout_stage: knockout || "none",
      updated_at: new Date().toISOString(),
    },
    { onConflict: "pool_id,team_id" },
  );
  if (error) return fail(error.message);

  await supabase.from("pools").update({ status: "active" }).eq("id", poolId);
  revalidateRoom(code);
  return ok("Result saved.");
}

export async function setPaidAction(formData: FormData): Promise<void> {
  const poolId = str(formData, "pool_id");
  const code = str(formData, "room_code");
  const playerId = str(formData, "player_id");
  const paid = str(formData, "paid") === "true";
  await assertHost(poolId);
  const supabase = getServerSupabase();
  const { error } = await supabase
    .from("players")
    .update({ paid })
    .eq("id", playerId);
  if (error) throw error;
  revalidateRoom(code);
}

// ---------------------------------------------------------------------------
// Trades (peer-to-peer)
// ---------------------------------------------------------------------------

/** Find the current user's player row in a pool, if any. */
async function currentPlayer(poolId: string): Promise<Player | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("players")
    .select("*")
    .eq("pool_id", poolId)
    .eq("user_id", user.id)
    .maybeSingle();
  return (data as Player) ?? null;
}

/** Map of team_id -> owning player_id for a pool. */
async function ownershipMap(poolId: string): Promise<Map<string, string>> {
  const supabase = getServerSupabase();
  const { data } = await supabase
    .from("team_assignments")
    .select("team_id, player_id")
    .eq("pool_id", poolId);
  const map = new Map<string, string>();
  for (const row of (data ?? []) as { team_id: string; player_id: string }[]) {
    map.set(row.team_id, row.player_id);
  }
  return map;
}

export async function proposeTradeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = str(formData, "room_code").toUpperCase();
  const receiverId = str(formData, "receiver_player_id");
  const message = str(formData, "message");
  const offered = strList(formData, "offered_team_ids");
  const requested = strList(formData, "requested_team_ids");

  const pool = await getPoolByCode(code);
  if (!pool) return fail("Pool not found.");

  const proposer = await currentPlayer(pool.id);
  if (!proposer) return fail("Join the pool before proposing a trade.");
  if (!receiverId) return fail("Pick who you want to trade with.");
  if (receiverId === proposer.id) return fail("You can't trade with yourself.");
  if (offered.length + requested.length === 0)
    return fail("Add at least one team to the trade.");

  const supabase = getServerSupabase();

  // Receiver must be a real player in this pool.
  const { data: receiver } = await supabase
    .from("players")
    .select("id")
    .eq("id", receiverId)
    .eq("pool_id", pool.id)
    .maybeSingle();
  if (!receiver) return fail("That player isn't in this pool.");

  // Validate current ownership of every team in the trade.
  const owners = await ownershipMap(pool.id);
  for (const teamId of offered) {
    if (owners.get(teamId) !== proposer.id)
      return fail("You can only offer teams you currently own.");
  }
  for (const teamId of requested) {
    if (owners.get(teamId) !== receiverId)
      return fail("You can only request teams the other player owns.");
  }

  const { data: trade, error: tradeError } = await supabase
    .from("trades")
    .insert({
      pool_id: pool.id,
      proposer_player_id: proposer.id,
      receiver_player_id: receiverId,
      message: message || null,
    })
    .select("id")
    .single();
  if (tradeError) return fail(tradeError.message);

  const items = [
    ...offered.map((teamId) => ({
      trade_id: trade.id,
      team_id: teamId,
      from_player_id: proposer.id,
    })),
    ...requested.map((teamId) => ({
      trade_id: trade.id,
      team_id: teamId,
      from_player_id: receiverId,
    })),
  ];
  const { error: itemsError } = await supabase
    .from("trade_items")
    .insert(items);
  if (itemsError) return fail(itemsError.message);

  revalidateRoom(code);
  return ok("Trade proposed! Waiting for the other player to respond.");
}

export async function respondTradeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = str(formData, "room_code").toUpperCase();
  const tradeId = str(formData, "trade_id");
  const decision = str(formData, "decision");

  const user = await getCurrentUser();
  if (!user) return fail("Please log in.");

  const supabase = getServerSupabase();
  const { data: tradeRow } = await supabase
    .from("trades")
    .select("*")
    .eq("id", tradeId)
    .maybeSingle();
  const trade = tradeRow as Trade | null;
  if (!trade) return fail("Trade not found.");
  if (trade.status !== "pending")
    return fail("This trade is no longer pending.");

  // Only the receiver may accept/reject.
  const { data: receiver } = await supabase
    .from("players")
    .select("id, user_id")
    .eq("id", trade.receiver_player_id)
    .maybeSingle();
  if (!receiver || receiver.user_id !== user.id)
    return fail("Only the player who received this trade can respond.");

  if (decision === "reject") {
    await supabase
      .from("trades")
      .update({ status: "rejected", responded_at: new Date().toISOString() })
      .eq("id", trade.id);
    revalidateRoom(code);
    return ok("Trade rejected.");
  }

  if (decision !== "accept") return fail("Unknown action.");

  // Re-validate ownership before swapping.
  const { data: itemRows } = await supabase
    .from("trade_items")
    .select("*")
    .eq("trade_id", trade.id);
  const items = (itemRows as TradeItem[]) ?? [];
  const owners = await ownershipMap(trade.pool_id);
  const stale = items.some((it) => owners.get(it.team_id) !== it.from_player_id);
  if (stale) {
    await supabase
      .from("trades")
      .update({ status: "voided", responded_at: new Date().toISOString() })
      .eq("id", trade.id);
    revalidateRoom(code);
    return fail("Teams changed since this was proposed — the trade was voided.");
  }

  // Apply the swap: each team goes to the OTHER party.
  for (const it of items) {
    const newOwner =
      it.from_player_id === trade.proposer_player_id
        ? trade.receiver_player_id
        : trade.proposer_player_id;
    const { error } = await supabase
      .from("team_assignments")
      .update({ player_id: newOwner })
      .eq("pool_id", trade.pool_id)
      .eq("team_id", it.team_id);
    if (error) return fail(error.message);
  }

  await supabase
    .from("trades")
    .update({ status: "accepted", responded_at: new Date().toISOString() })
    .eq("id", trade.id);

  // Void any other pending trades that touch the same teams.
  const tradedTeamIds = new Set(items.map((it) => it.team_id));
  const { data: otherPending } = await supabase
    .from("trades")
    .select("id")
    .eq("pool_id", trade.pool_id)
    .eq("status", "pending")
    .neq("id", trade.id);
  const otherIds = ((otherPending ?? []) as { id: string }[]).map((t) => t.id);
  if (otherIds.length > 0) {
    const { data: otherItems } = await supabase
      .from("trade_items")
      .select("trade_id, team_id")
      .in("trade_id", otherIds);
    const toVoid = new Set<string>();
    for (const oi of (otherItems ?? []) as {
      trade_id: string;
      team_id: string;
    }[]) {
      if (tradedTeamIds.has(oi.team_id)) toVoid.add(oi.trade_id);
    }
    if (toVoid.size > 0) {
      await supabase
        .from("trades")
        .update({ status: "voided", responded_at: new Date().toISOString() })
        .in("id", [...toVoid]);
    }
  }

  revalidateRoom(code);
  return ok("Trade accepted! Squads updated.");
}

export async function cancelTradeAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const code = str(formData, "room_code").toUpperCase();
  const tradeId = str(formData, "trade_id");

  const user = await getCurrentUser();
  if (!user) return fail("Please log in.");

  const supabase = getServerSupabase();
  const { data: tradeRow } = await supabase
    .from("trades")
    .select("*")
    .eq("id", tradeId)
    .maybeSingle();
  const trade = tradeRow as Trade | null;
  if (!trade) return fail("Trade not found.");
  if (trade.status !== "pending")
    return fail("Only pending trades can be cancelled.");

  const { data: proposer } = await supabase
    .from("players")
    .select("id, user_id")
    .eq("id", trade.proposer_player_id)
    .maybeSingle();
  if (!proposer || proposer.user_id !== user.id)
    return fail("Only the player who proposed this trade can cancel it.");

  await supabase
    .from("trades")
    .update({ status: "cancelled", responded_at: new Date().toISOString() })
    .eq("id", trade.id);
  revalidateRoom(code);
  return ok("Trade cancelled.");
}
