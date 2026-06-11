import { notFound } from "next/navigation";
import { Card, SectionTitle, Badge, EmptyState } from "@/components/ui";
import { RoomNav } from "@/components/RoomNav";
import { MatchupControls } from "@/components/MatchupControls";
import { RefreshMatchupsForm } from "@/components/forms";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser, isPoolAdmin } from "@/lib/auth";
import { getFullRoom } from "@/lib/data";
import { countIncomingTrades } from "@/lib/trades";
import {
  buildMatchups,
  filterMatchups,
  poolImpact,
  splitMatchups,
  todaySections,
  MATCH_TIME_ZONE,
  type MatchDay,
  type MatchStatusCategory,
  type Matchup,
  type MatchupSide,
  type RoundFilter,
} from "@/lib/matchups";
import type { ScoringRule } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<
  MatchStatusCategory,
  "green" | "amber" | "blue" | "red" | "slate"
> = {
  live: "red",
  finished: "green",
  upcoming: "blue",
  postponed: "amber",
  cancelled: "amber",
  unknown: "slate",
};

const VALID_TABS: MatchDay[] = ["today", "previous", "upcoming"];
const VALID_ROUNDS: RoundFilter[] = ["all", "group", "knockout"];

// All times shown in Pacific (the whole pool is PST/PDT), with a "PT" suffix.
function formatTime(value: string | null): string {
  if (!value) return "Time TBD";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Time TBD";
  return `${new Intl.DateTimeFormat("en-US", {
    timeStyle: "short",
    timeZone: MATCH_TIME_ZONE,
  }).format(d)} PT`;
}

function formatDate(value: string | null): string {
  if (!value) return "Date TBD";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Date TBD";
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: MATCH_TIME_ZONE,
  }).format(d);
}

const todayLabel = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  timeZone: MATCH_TIME_ZONE,
}).format(new Date());

export default async function MatchupsPage({
  params,
  searchParams,
}: {
  params: { code: string };
  searchParams: { tab?: string; round?: string; player?: string };
}) {
  if (!isSupabaseConfigured()) return <SupabaseNotice />;

  const code = params.code.toUpperCase();
  const [room, user] = await Promise.all([getFullRoom(code), getCurrentUser()]);
  if (!room) notFound();

  const { pool, players, teams, assignments, fixtures, rules } = room;
  const isAdmin = isPoolAdmin(pool, user);
  const tradeCount = countIncomingTrades(room.trades, players, user?.id);
  const currentPlayer = user
    ? players.find((p) => p.user_id === user.id) ?? null
    : null;

  // URL-driven state (validated).
  const tab: MatchDay = VALID_TABS.includes(searchParams.tab as MatchDay)
    ? (searchParams.tab as MatchDay)
    : "today";
  const round: RoundFilter = VALID_ROUNDS.includes(
    searchParams.round as RoundFilter,
  )
    ? (searchParams.round as RoundFilter)
    : "all";
  const playerId =
    players.find((p) => p.id === searchParams.player)?.id ?? "";

  const all = buildMatchups({ fixtures, teams, assignments, players });
  const filtered = filterMatchups(all, { round, playerId });
  const split = splitMatchups(filtered);
  const counts: Record<MatchDay, number> = {
    today: split.today.length,
    previous: split.previous.length,
    upcoming: split.upcoming.length,
  };

  const hasFixtures = all.length > 0;
  const hasAssignments = assignments.length > 0;

  return (
    <div className="space-y-6">
      <RoomNav
        code={code}
        isAdmin={isAdmin}
        showTrade={hasAssignments}
        tradeCount={tradeCount}
        active="matchups"
      />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            ⚽ Matchups
          </h1>
          <p className="text-sm text-slate-500">{todayLabel}</p>
        </div>
        {isAdmin && hasFixtures && (
          <RefreshMatchupsForm poolId={pool.id} code={code} />
        )}
      </div>

      {!hasFixtures ? (
        <EmptyState>
          No World Cup fixtures yet.{" "}
          {isAdmin
            ? "Use “Sync World Cup results” on the Admin tab to load matchups."
            : "Ask the host to sync fixtures to load matchups."}
        </EmptyState>
      ) : (
        <>
          {!hasAssignments && (
            <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Teams haven&apos;t been drawn yet, so owners aren&apos;t shown.
              Run the draw to see who owns each team.
            </div>
          )}

          <MatchupControls
            tab={tab}
            round={round}
            playerId={playerId}
            players={players}
            counts={counts}
          />

          {tab === "today" && (
            <TodayView matchups={split.today} rules={rules} />
          )}
          {tab === "previous" && (
            <Section
              title="Previous matchups"
              subtitle="Completed matches before today."
              matchups={split.previous}
              rules={rules}
              currentPlayerId={currentPlayer?.id}
              empty="No previous matchups yet."
            />
          )}
          {tab === "upcoming" && (
            <Section
              title="Upcoming matchups"
              subtitle="Matches scheduled after today."
              matchups={split.upcoming}
              rules={rules}
              currentPlayerId={currentPlayer?.id}
              empty="No upcoming matchups scheduled."
            />
          )}
        </>
      )}
    </div>
  );
}

function TodayView({
  matchups,
  rules,
}: {
  matchups: Matchup[];
  rules: ScoringRule[];
}) {
  const { live, upcoming, completed } = todaySections(matchups);
  return (
    <div className="space-y-6">
      <Section
        title="🔴 Live"
        matchups={live}
        rules={rules}
        empty="No live World Cup matches right now."
      />
      <Section
        title="⏰ Upcoming today"
        matchups={upcoming}
        rules={rules}
        empty="No more matches scheduled for today."
      />
      <Section
        title="✅ Completed today"
        matchups={completed}
        rules={rules}
        empty="No matches have finished today yet."
      />
    </div>
  );
}

function Section({
  title,
  subtitle,
  matchups,
  rules,
  empty,
  currentPlayerId,
}: {
  title: string;
  subtitle?: string;
  matchups: Matchup[];
  rules: ScoringRule[];
  empty: string;
  currentPlayerId?: string;
}) {
  return (
    <div>
      <SectionTitle title={title} subtitle={subtitle} />
      {matchups.length === 0 ? (
        <EmptyState>{empty}</EmptyState>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {matchups.map((m) => (
            <MatchupCard
              key={m.fixtureId}
              matchup={m}
              rules={rules}
              currentPlayerId={currentPlayerId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MatchupCard({
  matchup,
  rules,
  currentPlayerId,
}: {
  matchup: Matchup;
  rules: ScoringRule[];
  currentPlayerId?: string;
}) {
  const impact = poolImpact(matchup, rules);
  const scoreline =
    matchup.home.goals != null && matchup.away.goals != null
      ? `${matchup.home.goals} – ${matchup.away.goals}`
      : null;

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-slate-500">
          {matchup.round ?? "World Cup"}
        </span>
        <Badge tone={STATUS_TONE[matchup.status.category]}>
          {matchup.status.label}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{formatTime(matchup.kickoffAt)}</span>
        {!matchup.isFinished && <span>{formatDate(matchup.kickoffAt)}</span>}
        {matchup.venueName && (
          <span className="truncate">
            {matchup.venueName}
            {matchup.venueCity ? `, ${matchup.venueCity}` : ""}
          </span>
        )}
      </div>

      <div className="space-y-2">
        <TeamRow
          side={matchup.home}
          finished={matchup.isFinished}
          isDraw={matchup.isDraw}
          currentPlayerId={currentPlayerId}
        />
        <TeamRow
          side={matchup.away}
          finished={matchup.isFinished}
          isDraw={matchup.isDraw}
          currentPlayerId={currentPlayerId}
        />
      </div>

      {matchup.isFinished && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
          {scoreline && (
            <p className="font-semibold text-slate-700">
              Final: {matchup.home.name} {scoreline} {matchup.away.name}
            </p>
          )}
          {matchup.isDraw ? (
            <p className="text-slate-500">Draw</p>
          ) : (
            <p className="text-slate-500">
              Winner:{" "}
              <span className="font-semibold text-pitch-700">
                {matchup.home.isWinner ? matchup.home.name : matchup.away.name}
              </span>
              {" · "}Loser:{" "}
              {matchup.home.isLoser ? matchup.home.name : matchup.away.name}
            </p>
          )}
          {impact.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-slate-500">
              {impact.map((line, i) => (
                <li key={i}>• {line}</li>
              ))}
            </ul>
          )}
          <p className="mt-1 text-[11px] text-slate-400">
            {matchup.includedInStandings
              ? "Counted in standings"
              : "Not yet in standings"}
          </p>
        </div>
      )}

      {!matchup.isFinished && scoreline && (
        <p className="text-center text-sm font-bold text-slate-800">
          {scoreline}
        </p>
      )}
    </Card>
  );
}

function TeamRow({
  side,
  finished,
  isDraw,
  currentPlayerId,
}: {
  side: MatchupSide;
  finished: boolean;
  isDraw: boolean;
  currentPlayerId?: string;
}) {
  const dimmed = finished && side.isLoser && !isDraw;
  const isMine = currentPlayerId && side.owner?.id === currentPlayerId;
  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-2 py-1.5 ${
        finished && side.isWinner && !isDraw ? "bg-pitch-50" : ""
      } ${dimmed ? "opacity-60" : ""}`}
    >
      {side.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={side.logoUrl} alt="" className="h-6 w-6 object-contain" />
      ) : (
        <span className="text-xl">{side.flag ?? "🏳️"}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-bold text-slate-900">
            {side.name ?? "TBD"}
          </span>
          {finished && side.isWinner && !isDraw && (
            <span className="text-xs">🏆</span>
          )}
        </div>
        <p className="truncate text-xs text-slate-400">
          {side.owner ? (
            <>
              Owner:{" "}
              <span className="font-medium text-slate-600">
                {side.owner.name}
              </span>
              {isMine && (
                <span className="ml-1 font-semibold text-pitch-700">(you)</span>
              )}
            </>
          ) : (
            <span className="italic">Not assigned to a player yet</span>
          )}
        </p>
      </div>
      {side.goals != null && (
        <span className="text-2xl font-extrabold text-slate-900">
          {side.goals}
        </span>
      )}
    </div>
  );
}
