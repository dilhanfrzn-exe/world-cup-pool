import { notFound } from "next/navigation";
import { Card, SectionTitle, Badge, EmptyState, LinkButton } from "@/components/ui";
import { RoomNav } from "@/components/RoomNav";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import {
  ProposeTradeForm,
  RespondButtons,
  CancelButton,
  type OtherPlayer,
} from "@/components/trades";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser, isPoolAdmin } from "@/lib/auth";
import { getFullRoom } from "@/lib/data";
import {
  buildEnrichedTrades,
  countIncomingTrades,
  tradeStatusLabel,
  type EnrichedTrade,
} from "@/lib/trades";
import type { Team } from "@/lib/types";

export const dynamic = "force-dynamic";

function TeamPills({ teams }: { teams: Team[] }) {
  if (teams.length === 0)
    return <span className="text-xs text-slate-400">nothing</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {teams.map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2 py-0.5 text-xs"
        >
          <span>{t.flag ?? "🏳️"}</span>
          <span className="font-medium text-slate-700">{t.name}</span>
        </span>
      ))}
    </span>
  );
}

function TradeSummary({ trade }: { trade: EnrichedTrade }) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          {trade.proposer?.name ?? "?"} gives
        </p>
        <TeamPills teams={trade.offered} />
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          and gets
        </p>
        <TeamPills teams={trade.requested} />
      </div>
      {trade.trade.message && (
        <p className="text-xs italic text-slate-500">“{trade.trade.message}”</p>
      )}
    </div>
  );
}

export default async function TradePage({
  params,
}: {
  params: { code: string };
}) {
  if (!isSupabaseConfigured()) return <SupabaseNotice />;

  const code = params.code.toUpperCase();
  const [room, user] = await Promise.all([getFullRoom(code), getCurrentUser()]);
  if (!room) notFound();

  const { pool, players, teams, assignments, trades, tradeItems } = room;
  const isAdmin = isPoolAdmin(pool, user);
  const drawn = assignments.length > 0;
  const currentPlayer = user
    ? players.find((p) => p.user_id === user.id) ?? null
    : null;

  // teams owned by each player right now
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const teamsByPlayer = new Map<string, Team[]>();
  for (const a of assignments) {
    const t = teamById.get(a.team_id);
    if (!t) continue;
    const list = teamsByPlayer.get(a.player_id) ?? [];
    list.push(t);
    teamsByPlayer.set(a.player_id, list);
  }

  const enriched = buildEnrichedTrades(trades, tradeItems, players, teams);
  const tradeCount = countIncomingTrades(trades, players, user?.id);

  const header = (
    <>
      <RoomNav
        code={code}
        isAdmin={isAdmin}
        showTrade={drawn}
        tradeCount={tradeCount}
        active="trade"
      />
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">🔁 Trades</h1>
        <p className="text-sm text-slate-500">{pool.name}</p>
      </div>
    </>
  );

  if (!drawn) {
    return (
      <div className="space-y-6">
        {header}
        <EmptyState>Trading opens once the host has run the draw.</EmptyState>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="space-y-6">
        {header}
        <Card>
          <p className="mb-3 text-sm text-slate-600">
            Log in as a player in this pool to propose and accept trades.
          </p>
          <LinkButton href={`/login?next=/room/${code}/trade`}>Log in</LinkButton>
        </Card>
      </div>
    );
  }

  const incoming = currentPlayer
    ? enriched.filter(
        (t) =>
          t.trade.status === "pending" &&
          t.trade.receiver_player_id === currentPlayer.id,
      )
    : [];
  const outgoing = currentPlayer
    ? enriched.filter(
        (t) =>
          t.trade.status === "pending" &&
          t.trade.proposer_player_id === currentPlayer.id,
      )
    : [];
  const history = enriched.filter((t) => t.trade.status !== "pending");

  const others: OtherPlayer[] = currentPlayer
    ? players
        .filter((p) => p.id !== currentPlayer.id && p.user_id)
        .map((p) => ({
          id: p.id,
          name: p.name,
          teams: teamsByPlayer.get(p.id) ?? [],
        }))
    : [];

  return (
    <div className="space-y-6">
      {header}

      {!currentPlayer && (
        <EmptyState>
          You&apos;re viewing as a non-player. Join the pool from the Room tab to
          trade.
        </EmptyState>
      )}

      {currentPlayer && (
        <Card>
          <SectionTitle
            title="Propose a trade"
            subtitle="Pick teams to give and to get. Uneven trades are allowed."
          />
          <ProposeTradeForm
            roomCode={code}
            myTeams={teamsByPlayer.get(currentPlayer.id) ?? []}
            others={others}
          />
        </Card>
      )}

      {currentPlayer && (
        <Card>
          <SectionTitle title={`Incoming (${incoming.length})`} subtitle="Trades waiting on you." />
          {incoming.length === 0 ? (
            <EmptyState>No incoming trades.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {incoming.map((t) => (
                <li key={t.trade.id} className="rounded-xl border border-slate-100 p-3">
                  <TradeSummary trade={t} />
                  <div className="mt-3">
                    <RespondButtons roomCode={code} tradeId={t.trade.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {currentPlayer && (
        <Card>
          <SectionTitle title={`Outgoing (${outgoing.length})`} subtitle="Your pending offers." />
          {outgoing.length === 0 ? (
            <EmptyState>No outgoing trades.</EmptyState>
          ) : (
            <ul className="space-y-3">
              {outgoing.map((t) => (
                <li key={t.trade.id} className="rounded-xl border border-slate-100 p-3">
                  <div className="mb-1 text-xs font-semibold text-slate-500">
                    To {t.receiver?.name ?? "?"}
                  </div>
                  <TradeSummary trade={t} />
                  <div className="mt-3">
                    <CancelButton roomCode={code} tradeId={t.trade.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card>
        <SectionTitle title="Trade history" subtitle="Completed and closed trades." />
        {history.length === 0 ? (
          <EmptyState>No past trades yet.</EmptyState>
        ) : (
          <ul className="space-y-3">
            {history.map((t) => (
              <li
                key={t.trade.id}
                className="flex flex-col gap-2 rounded-xl border border-slate-100 p-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <TradeSummary trade={t} />
                <Badge
                  tone={
                    t.trade.status === "accepted"
                      ? "green"
                      : t.trade.status === "voided"
                        ? "amber"
                        : "slate"
                  }
                >
                  {tradeStatusLabel(t.trade.status)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
