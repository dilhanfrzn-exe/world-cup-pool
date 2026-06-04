import { notFound } from "next/navigation";
import { Card, EmptyState, LinkButton } from "@/components/ui";
import { RoomNav } from "@/components/RoomNav";
import { CopyLink } from "@/components/CopyLink";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { TIER_LABELS } from "@/lib/teams";
import { getAppUrl } from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser, isPoolAdmin } from "@/lib/auth";
import { getFullRoom } from "@/lib/data";
import { countIncomingTrades } from "@/lib/trades";
import type { Team } from "@/lib/types";

export const dynamic = "force-dynamic";

const CARD_COLORS = [
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-indigo-600",
  "from-fuchsia-500 to-purple-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-red-600",
  "from-cyan-500 to-blue-600",
  "from-lime-500 to-green-600",
  "from-violet-500 to-indigo-600",
];

export default async function ResultsPage({
  params,
}: {
  params: { code: string };
}) {
  if (!isSupabaseConfigured()) return <SupabaseNotice />;

  const code = params.code.toUpperCase();
  const [room, user] = await Promise.all([getFullRoom(code), getCurrentUser()]);
  if (!room) notFound();

  const { pool, players, teams, assignments } = room;
  const isAdmin = isPoolAdmin(pool, user);

  const teamById = new Map<string, Team>();
  for (const t of teams) teamById.set(t.id, t);

  const teamsByPlayer = new Map<string, Team[]>();
  for (const a of assignments) {
    const team = teamById.get(a.team_id);
    if (!team) continue;
    const list = teamsByPlayer.get(a.player_id) ?? [];
    list.push(team);
    teamsByPlayer.set(a.player_id, list);
  }

  const drawn = assignments.length > 0;
  const resultsUrl = `${getAppUrl()}/room/${code}/results`;
  const tradeCount = countIncomingTrades(room.trades, players, user?.id);

  return (
    <div className="space-y-6">
      <RoomNav
        code={code}
        isAdmin={isAdmin}
        showTrade={drawn}
        tradeCount={tradeCount}
        active="results"
      />

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">🎲 Draw results</h1>
        <p className="text-sm text-slate-500">{pool.name}</p>
      </div>

      {!drawn ? (
        <EmptyState>
          The draw hasn&apos;t been run yet.{" "}
          {isAdmin
            ? "Head to the Room tab to run it."
            : "Check back once the host runs it."}
        </EmptyState>
      ) : (
        <>
          <Card>
            <p className="mb-2 text-sm font-semibold text-slate-700">
              Share these results with the group:
            </p>
            <CopyLink value={resultsUrl} />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            {players.map((player, i) => {
              const pteams = (teamsByPlayer.get(player.id) ?? []).sort(
                (a, b) => a.tier - b.tier || a.name.localeCompare(b.name),
              );
              return (
                <div
                  key={player.id}
                  className="animate-pop-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  style={{ animationDelay: `${i * 70}ms` }}
                >
                  <div
                    className={`bg-gradient-to-r ${CARD_COLORS[i % CARD_COLORS.length]} px-4 py-3 text-white`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-extrabold text-black">{player.name}</h3>
                      <span className="rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">
                        {pteams.length} teams
                      </span>
                    </div>
                    {player.nickname && (
                      <p className="text-sm text-white/80">“{player.nickname}”</p>
                    )}
                  </div>
                  <ul className="divide-y divide-slate-100 px-4 py-2">
                    {pteams.map((t) => (
                      <li key={t.id} className="flex items-center gap-3 py-2">
                        <span className="text-xl">{t.flag ?? "🏳️"}</span>
                        <span className="font-semibold text-slate-800">{t.name}</span>
                        <span className="ml-auto text-xs text-slate-400">
                          {TIER_LABELS[t.tier]?.split("·")[0]?.trim() ?? `Tier ${t.tier}`}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>

          <div className="flex justify-center gap-3">
            <LinkButton href={`/room/${code}/trade`} variant="secondary">
              Trade teams
            </LinkButton>
            <LinkButton href={`/room/${code}/standings`}>
              View standings →
            </LinkButton>
          </div>
        </>
      )}
    </div>
  );
}
