import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, SectionTitle, Badge, EmptyState, LinkButton } from "@/components/ui";
import { RoomNav } from "@/components/RoomNav";
import { PoolHeader } from "@/components/PoolHeader";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { SubmitButton } from "@/components/SubmitButton";
import {
  AddPlayerForm,
  AddTeamForm,
  SeedTeamsForm,
  RunDrawForm,
  JoinForm,
} from "@/components/forms";
import { TIER_LABELS } from "@/lib/teams";
import { drawTypeLabel } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser, isPoolAdmin, isSuperAdmin } from "@/lib/auth";
import { getFullRoom } from "@/lib/data";
import { countIncomingTrades } from "@/lib/trades";
import { removePlayerAction, removeTeamAction, clearDrawAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function RoomPage({
  params,
}: {
  params: { code: string };
}) {
  if (!isSupabaseConfigured()) {
    return <SupabaseNotice />;
  }

  const code = params.code.toUpperCase();
  const [room, user] = await Promise.all([getFullRoom(code), getCurrentUser()]);
  if (!room) {
    notFound();
  }

  const { pool, players, teams, assignments } = room;
  const isAdmin = isPoolAdmin(pool, user);
  const superAdmin = isSuperAdmin(user?.email);
  const currentPlayer = user
    ? players.find((p) => p.user_id === user.id) ?? null
    : null;

  // Group teams by tier for display + draw validation.
  const teamsByTier = new Map<number, typeof teams>();
  for (const t of teams) {
    const list = teamsByTier.get(t.tier) ?? [];
    list.push(t);
    teamsByTier.set(t.tier, list);
  }
  const tiers = [...teamsByTier.keys()].sort((a, b) => a - b);

  const np = players.length;
  const nt = teams.length;
  const randomOk = np > 0 && nt > 0 && nt % np === 0;
  const tieredBadTier = tiers.find(
    (tier) => np === 0 || teamsByTier.get(tier)!.length % np !== 0,
  );
  const alreadyDrawn = assignments.length > 0;
  const tradeCount = countIncomingTrades(room.trades, players, user?.id);

  return (
    <div className="space-y-6">
      <PoolHeader pool={pool} isAdmin={isAdmin} isSuperAdmin={superAdmin} />
      <RoomNav
        code={code}
        isAdmin={isAdmin}
        showTrade={alreadyDrawn}
        tradeCount={tradeCount}
        active="room"
      />

      {/* Players ------------------------------------------------------- */}
      <Card>
        <SectionTitle
          title={`Players (${np})`}
          subtitle={
            pool.num_players ? `Target: ${pool.num_players} players` : undefined
          }
        />
        {players.length === 0 ? (
          <EmptyState>No players yet. Share the room link to invite friends.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="font-semibold text-slate-900">{p.name}</span>
                  {p.nickname && (
                    <span className="ml-2 text-sm text-slate-400">“{p.nickname}”</span>
                  )}
                  {currentPlayer?.id === p.id && (
                    <span className="ml-2 text-xs font-semibold text-pitch-700">
                      (you)
                    </span>
                  )}
                  {!p.user_id && (
                    <span className="ml-2 text-xs text-slate-400">· placeholder</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={p.paid ? "green" : "amber"}>
                    {p.paid ? "Paid" : "Unpaid"}
                  </Badge>
                  {isAdmin && (
                    <form action={removePlayerAction}>
                      <input type="hidden" name="pool_id" value={pool.id} />
                      <input type="hidden" name="room_code" value={code} />
                      <input type="hidden" name="player_id" value={p.id} />
                      <button
                        type="submit"
                        className="text-xs font-semibold text-red-500 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </form>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          {currentPlayer ? (
            <p className="text-sm text-slate-500">
              You&apos;re in this pool as{" "}
              <span className="font-semibold text-slate-800">{currentPlayer.name}</span>.
            </p>
          ) : user ? (
            <div>
              <h3 className="mb-2 text-sm font-bold text-slate-700">Join this pool</h3>
              <JoinForm roomCode={code} />
            </div>
          ) : (
            <div className="rounded-xl bg-slate-50 p-4 text-center">
              <p className="mb-3 text-sm text-slate-600">
                Log in to join this pool and trade teams.
              </p>
              <LinkButton href={`/login?next=/room/${code}`}>
                Log in to join
              </LinkButton>
            </div>
          )}

          {isAdmin && (
            <div className="border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-bold text-slate-700">
                Add a placeholder player (host)
              </h3>
              <AddPlayerForm poolId={pool.id} code={code} />
            </div>
          )}
        </div>
      </Card>

      {/* Teams --------------------------------------------------------- */}
      <Card>
        <SectionTitle
          title={`Teams (${nt})`}
          subtitle="Split into tiers/pots for a fair tiered draw."
        />
        {teams.length === 0 ? (
          <EmptyState>
            No teams yet.
            {isAdmin
              ? " Load the 48 World Cup teams or add your own below."
              : " The host hasn’t added teams yet."}
          </EmptyState>
        ) : (
          <div className="space-y-4">
            {tiers.map((tier) => (
              <div key={tier}>
                <div className="mb-1.5 flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-700">
                    {TIER_LABELS[tier] ?? `Tier ${tier}`}
                  </h3>
                  <span className="text-xs text-slate-400">
                    {teamsByTier.get(tier)!.length} teams
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {teamsByTier.get(tier)!.map((t) => (
                    <span
                      key={t.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-1 text-sm"
                    >
                      <span>{t.flag ?? "🏳️"}</span>
                      <span className="font-medium text-slate-800">{t.name}</span>
                      {isAdmin && (
                        <form action={removeTeamAction} className="inline">
                          <input type="hidden" name="pool_id" value={pool.id} />
                          <input type="hidden" name="room_code" value={code} />
                          <input type="hidden" name="team_id" value={t.id} />
                          <button
                            type="submit"
                            className="ml-0.5 text-slate-400 hover:text-red-600"
                            title="Remove team"
                          >
                            ×
                          </button>
                        </form>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {isAdmin && (
          <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
            {teams.length === 0 && (
              <SeedTeamsForm poolId={pool.id} code={code} />
            )}
            <AddTeamForm poolId={pool.id} code={code} />
          </div>
        )}
      </Card>

      {/* Draw controls (admin) ---------------------------------------- */}
      {isAdmin && (
        <Card>
          <SectionTitle
            title="Run the draw"
            subtitle={`Draw type: ${drawTypeLabel(pool.draw_type)}`}
          />
          <div className="mb-4 space-y-2 text-sm">
            <DrawCheck ok={np > 0} label={`${np} player${np === 1 ? "" : "s"} added`} />
            <DrawCheck ok={nt > 0} label={`${nt} teams added`} />
            {pool.draw_type === "random" && (
              <DrawCheck
                ok={randomOk}
                label={
                  np > 0
                    ? `Teams divide evenly (${np ? nt / np : 0} per player)`
                    : "Need players to check split"
                }
              />
            )}
            {pool.draw_type === "tiered" && (
              <DrawCheck
                ok={np > 0 && tieredBadTier === undefined}
                label={
                  tieredBadTier !== undefined
                    ? `Tier ${tieredBadTier} doesn’t split evenly`
                    : "Every tier splits evenly across players"
                }
              />
            )}
            {pool.draw_type === "auction" && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-amber-800">
                Auction draw is coming soon. Switch the pool to random or tiered
                to run a draw now.
              </p>
            )}
          </div>

          {alreadyDrawn && (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-pitch-50 px-3 py-2 text-sm text-pitch-800">
              <span>Draw complete — {assignments.length} teams assigned.</span>
              <Link href={`/room/${code}/results`} className="font-semibold underline">
                View results
              </Link>
            </div>
          )}

          {pool.draw_type !== "auction" && (
            <RunDrawForm
              poolId={pool.id}
              code={code}
              drawTypeLabel={drawTypeLabel(pool.draw_type)}
            />
          )}

          {alreadyDrawn && (
            <form action={clearDrawAction} className="mt-2">
              <input type="hidden" name="pool_id" value={pool.id} />
              <input type="hidden" name="room_code" value={code} />
              <SubmitButton variant="danger">Clear draw</SubmitButton>
            </form>
          )}
        </Card>
      )}

      {!isAdmin && (
        <p className="text-center text-xs text-slate-400">
          The host runs the draw and updates results. Once teams are drawn you can
          trade from the Trade tab.
        </p>
      )}
    </div>
  );
}

function DrawCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className={ok ? "text-pitch-600" : "text-slate-300"}>
        {ok ? "✓" : "○"}
      </span>
      <span className={ok ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </div>
  );
}
