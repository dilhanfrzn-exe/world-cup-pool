import "server-only";
import { getServerSupabase } from "./supabase/server";
import type {
  Player,
  Pool,
  ScoringRule,
  Team,
  TeamAssignment,
  TeamResult,
  Trade,
  TradeItem,
} from "./types";
import type { RoomData } from "./standings";

export interface PoolSummary extends Pool {
  player_count: number;
  paid_count: number;
}

/** All pools with per-pool player counts. Used by the super-admin dashboard. */
export async function getAllPoolSummaries(): Promise<PoolSummary[]> {
  const supabase = getServerSupabase();
  const [{ data: pools, error: poolsError }, { data: players, error: playersError }] =
    await Promise.all([
      supabase.from("pools").select("*").order("created_at", { ascending: false }),
      supabase.from("players").select("pool_id, paid"),
    ]);
  if (poolsError) throw poolsError;
  if (playersError) throw playersError;

  const counts = new Map<string, { total: number; paid: number }>();
  for (const p of (players ?? []) as { pool_id: string; paid: boolean }[]) {
    const c = counts.get(p.pool_id) ?? { total: 0, paid: 0 };
    c.total += 1;
    if (p.paid) c.paid += 1;
    counts.set(p.pool_id, c);
  }

  return ((pools ?? []) as Pool[]).map((pool) => ({
    ...pool,
    player_count: counts.get(pool.id)?.total ?? 0,
    paid_count: counts.get(pool.id)?.paid ?? 0,
  }));
}

export interface UserPool extends Pool {
  role: "host" | "player";
  player_count: number;
}

/** Pools the user hosts or has joined as a player, newest first. */
export async function getPoolsForUser(userId: string): Promise<UserPool[]> {
  const supabase = getServerSupabase();
  const [{ data: memberRows, error: memberError }, { data: hosted, error: hostedError }] =
    await Promise.all([
      supabase.from("players").select("pool_id").eq("user_id", userId),
      supabase.from("pools").select("*").eq("created_by", userId),
    ]);
  if (memberError) throw memberError;
  if (hostedError) throw hostedError;

  const hostedPools = (hosted ?? []) as Pool[];
  const hostedIds = new Set(hostedPools.map((p) => p.id));
  const memberIds = ((memberRows ?? []) as { pool_id: string }[]).map(
    (r) => r.pool_id,
  );
  const missingIds = memberIds.filter((id) => !hostedIds.has(id));

  let memberPools: Pool[] = [];
  if (missingIds.length > 0) {
    const { data, error } = await supabase
      .from("pools")
      .select("*")
      .in("id", missingIds);
    if (error) throw error;
    memberPools = (data as Pool[]) ?? [];
  }

  const allPools = [...hostedPools, ...memberPools];
  if (allPools.length === 0) return [];

  const { data: players, error: playersError } = await supabase
    .from("players")
    .select("pool_id")
    .in(
      "pool_id",
      allPools.map((p) => p.id),
    );
  if (playersError) throw playersError;

  const counts = new Map<string, number>();
  for (const row of (players ?? []) as { pool_id: string }[]) {
    counts.set(row.pool_id, (counts.get(row.pool_id) ?? 0) + 1);
  }

  return allPools
    .map((pool) => ({
      ...pool,
      role: (pool.created_by === userId ? "host" : "player") as
        | "host"
        | "player",
      player_count: counts.get(pool.id) ?? 0,
    }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function getPoolByCode(code: string): Promise<Pool | null> {
  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pools")
    .select("*")
    .eq("room_code", code.toUpperCase())
    .maybeSingle();
  if (error) throw error;
  return (data as Pool) ?? null;
}

export interface FullRoom extends RoomData {
  pool: Pool;
  trades: Trade[];
  tradeItems: TradeItem[];
}

/** Load everything needed to render a room/standings page in one shot. */
export async function getFullRoom(code: string): Promise<FullRoom | null> {
  const supabase = getServerSupabase();
  const pool = await getPoolByCode(code);
  if (!pool) return null;

  const [players, teams, assignments, results, rules, trades] =
    await Promise.all([
      supabase
        .from("players")
        .select("*")
        .eq("pool_id", pool.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("teams")
        .select("*")
        .eq("pool_id", pool.id)
        .order("tier", { ascending: true })
        .order("name", { ascending: true }),
      supabase.from("team_assignments").select("*").eq("pool_id", pool.id),
      supabase.from("team_results").select("*").eq("pool_id", pool.id),
      supabase.from("scoring_rules").select("*").eq("pool_id", pool.id),
      supabase
        .from("trades")
        .select("*")
        .eq("pool_id", pool.id)
        .order("created_at", { ascending: false }),
    ]);

  for (const res of [players, teams, assignments, results, rules, trades]) {
    if (res.error) throw res.error;
  }

  const tradeRows = (trades.data as Trade[]) ?? [];
  let tradeItems: TradeItem[] = [];
  if (tradeRows.length > 0) {
    const { data: items, error: itemsError } = await supabase
      .from("trade_items")
      .select("*")
      .in(
        "trade_id",
        tradeRows.map((t) => t.id),
      );
    if (itemsError) throw itemsError;
    tradeItems = (items as TradeItem[]) ?? [];
  }

  return {
    pool,
    players: (players.data as Player[]) ?? [],
    teams: (teams.data as Team[]) ?? [],
    assignments: (assignments.data as TeamAssignment[]) ?? [],
    results: (results.data as TeamResult[]) ?? [],
    rules: (rules.data as ScoringRule[]) ?? [],
    trades: tradeRows,
    tradeItems,
  };
}
