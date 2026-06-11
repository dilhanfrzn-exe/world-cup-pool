import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, SectionTitle, Badge, EmptyState, Stat } from "@/components/ui";
import { RoomNav } from "@/components/RoomNav";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { computeStandings } from "@/lib/standings";
import {
  computePayouts,
  formatMoney,
  formatDateTime,
  payoutStructureLabel,
} from "@/lib/utils";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser, isPoolAdmin } from "@/lib/auth";
import { getFullRoom } from "@/lib/data";
import { countIncomingTrades } from "@/lib/trades";

export const dynamic = "force-dynamic";

const MEDALS: Record<number, string> = { 1: "🥇", 2: "🥈", 3: "🥉" };

export default async function StandingsPage({
  params,
}: {
  params: { code: string };
}) {
  if (!isSupabaseConfigured()) return <SupabaseNotice />;

  const code = params.code.toUpperCase();
  const [room, user] = await Promise.all([getFullRoom(code), getCurrentUser()]);
  if (!room) notFound();

  const { pool, players, assignments, lastSync } = room;
  const isAdmin = isPoolAdmin(pool, user);
  const tradeCount = countIncomingTrades(room.trades, players, user?.id);

  const standings = computeStandings(room);
  const lastUpdated = formatDateTime(
    lastSync?.completed_at ?? lastSync?.started_at,
  );
  const paidCount = players.filter((p) => p.paid).length;
  const { pot, lines } = computePayouts(
    pool.buy_in,
    players.length,
    pool.payout_structure,
  );

  return (
    <div className="space-y-6">
      <RoomNav
        code={code}
        isAdmin={isAdmin}
        showTrade={assignments.length > 0}
        tradeCount={tradeCount}
        active="standings"
      />

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">📊 Standings</h1>
        <p className="text-sm text-slate-500">{pool.name}</p>
      </div>

      {/* Prize pot ---------------------------------------------------- */}
      <Card>
        <SectionTitle title="Prize pot" subtitle={payoutStructureLabel(pool.payout_structure)} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Buy-in" value={formatMoney(pool.buy_in)} />
          <Stat label="Players" value={players.length} />
          <Stat label="Prize pot" value={formatMoney(pot)} />
          <Stat
            label="Paid"
            value={`${paidCount}/${players.length}`}
            hint={
              players.length - paidCount > 0
                ? `${players.length - paidCount} unpaid`
                : "All settled"
            }
          />
        </div>
        <div className="mt-4 space-y-1.5">
          {lines.map((line) => (
            <div
              key={line.place}
              className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="font-semibold text-slate-700">{line.place}</span>
              <span className="font-extrabold text-pitch-700">
                {formatMoney(line.amount)}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Payments are tracked manually for now — no Stripe/Venmo/Zelle/PayPal.
        </p>
      </Card>

      {/* Leaderboard -------------------------------------------------- */}
      <Card>
        <SectionTitle
          title="Leaderboard"
          subtitle={
            lastSync
              ? `Last synced from API-Football: ${lastUpdated}`
              : "Updates as results sync or the host enters them."
          }
          action={
            <Link
              href={`/room/${code}/scoring`}
              className="shrink-0 text-sm font-semibold text-pitch-700 hover:underline"
            >
              How scoring works →
            </Link>
          }
        />
        {standings.length === 0 ? (
          <EmptyState>No players yet.</EmptyState>
        ) : (
          <ol className="space-y-2">
            {standings.map((row) => (
              <li
                key={row.player.id}
                className="rounded-xl border border-slate-100 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="w-7 text-center text-lg font-extrabold text-slate-400">
                      {MEDALS[row.rank] ?? row.rank}
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">
                          {row.player.name}
                        </span>
                        <Badge tone={row.player.paid ? "green" : "amber"}>
                          {row.player.paid ? "Paid" : "Unpaid"}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {row.teams.length} teams
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-extrabold text-pitch-700">
                      {row.totalPoints}
                    </div>
                    <div className="text-xs text-slate-400">points</div>
                  </div>
                </div>
                {row.teams.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5 pl-10">
                    {row.teams.map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs"
                        title={`${t.points} pts`}
                      >
                        <span>{t.flag ?? "🏳️"}</span>
                        <span className="font-medium text-slate-700">{t.name}</span>
                        <span className="text-slate-400">{t.points}</span>
                      </span>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
