import type {
  Fixture,
  Player,
  ScoringRule,
  Team,
  TeamAssignment,
} from "./types";
import { isKnockoutRound, normalizeRound } from "./api-football/rounds";
import { rulesToMap } from "./scoring";

/**
 * Pure (no I/O) helpers behind the "Matchups" tab.
 *
 * Everything here takes plain data and returns plain data so it can be unit
 * tested with no database or network, and reused on the server (page render,
 * sync) without pulling in `server-only`.
 */

// ---------------------------------------------------------------------------
// Status mapping
// ---------------------------------------------------------------------------
/** API short statuses that mean the match is over and the score is final. */
export const FINISHED_STATUSES = new Set(["FT", "AET", "PEN"]);

/** Coarse buckets the UI groups matches into. */
export type MatchStatusCategory =
  | "upcoming"
  | "live"
  | "finished"
  | "postponed"
  | "cancelled"
  | "unknown";

const UPCOMING_STATUSES = new Set(["TBD", "NS"]);
const LIVE_STATUSES = new Set([
  "1H",
  "HT",
  "2H",
  "ET",
  "BT",
  "P",
  "SUSP",
  "INT",
  "LIVE",
]);
const POSTPONED_STATUSES = new Set(["PST"]);
const CANCELLED_STATUSES = new Set(["CANC", "ABD", "AWD", "WO"]);

/** Short status code -> friendly fallback label (used when status_long is absent). */
const STATUS_LABELS: Record<string, string> = {
  TBD: "Kickoff TBD",
  NS: "Not started",
  "1H": "1st half",
  HT: "Half time",
  "2H": "2nd half",
  ET: "Extra time",
  BT: "Break time",
  P: "Penalties",
  SUSP: "Suspended",
  INT: "Interrupted",
  LIVE: "Live",
  FT: "Match finished",
  AET: "Finished (extra time)",
  PEN: "Finished (penalties)",
  PST: "Postponed",
  CANC: "Cancelled",
  ABD: "Abandoned",
  AWD: "Awarded",
  WO: "Walkover",
};

export interface MappedStatus {
  category: MatchStatusCategory;
  label: string;
}

/**
 * Normalize an API short status into a coarse category for grouping plus a
 * human label. `statusLong` (when present) wins for the label so the UI shows
 * exactly what API-Football reports.
 */
export function mapFixtureStatus(
  statusShort: string | null | undefined,
  statusLong?: string | null,
): MappedStatus {
  const short = (statusShort ?? "").toUpperCase();
  let category: MatchStatusCategory;
  if (FINISHED_STATUSES.has(short)) category = "finished";
  else if (LIVE_STATUSES.has(short)) category = "live";
  else if (UPCOMING_STATUSES.has(short)) category = "upcoming";
  else if (POSTPONED_STATUSES.has(short)) category = "postponed";
  else if (CANCELLED_STATUSES.has(short)) category = "cancelled";
  else category = "unknown";

  const label =
    statusLong?.trim() || STATUS_LABELS[short] || statusShort || "Unknown";
  return { category, label };
}

// ---------------------------------------------------------------------------
// Winner / loser / draw resolution
// ---------------------------------------------------------------------------
export interface FixtureResult {
  isFinished: boolean;
  isDraw: boolean;
  winnerApiId: number | null;
  loserApiId: number | null;
}

export interface FixtureResultInput {
  statusShort: string | null;
  homeApiId: number | null;
  awayApiId: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  /**
   * API-provided winner team id (from `teams.home/away.winner` flags). Needed
   * for knockout matches decided in extra time or on penalties, where goals
   * alone are tied. Ignored when the match isn't finished.
   */
  winnerHint?: number | null;
}

/**
 * Decide the outcome of a fixture.
 *
 *  - Not finished        -> no winner/loser, not a draw.
 *  - `winnerHint` set     -> trust the API (covers ET / PEN / awarded games).
 *  - Otherwise by goals   -> higher score wins.
 *  - Finished + tied + no winner -> a draw (group stage), no winner/loser.
 */
export function determineFixtureResult(
  input: FixtureResultInput,
): FixtureResult {
  const isFinished = FINISHED_STATUSES.has((input.statusShort ?? "").toUpperCase());
  if (!isFinished) {
    return { isFinished: false, isDraw: false, winnerApiId: null, loserApiId: null };
  }

  const { homeGoals, awayGoals, homeApiId, awayApiId } = input;
  let winnerApiId: number | null = null;
  if (input.winnerHint != null) {
    winnerApiId = input.winnerHint;
  } else if (homeGoals != null && awayGoals != null) {
    if (homeGoals > awayGoals) winnerApiId = homeApiId;
    else if (awayGoals > homeGoals) winnerApiId = awayApiId;
  }

  const isDraw =
    homeGoals != null &&
    awayGoals != null &&
    homeGoals === awayGoals &&
    winnerApiId == null;

  let loserApiId: number | null = null;
  if (winnerApiId != null) {
    loserApiId = winnerApiId === homeApiId ? awayApiId : homeApiId;
  }

  return { isFinished, isDraw, winnerApiId, loserApiId };
}

// ---------------------------------------------------------------------------
// Date windows (today / previous / upcoming)
// ---------------------------------------------------------------------------
export interface DateRange {
  start: Date;
  end: Date;
}

/**
 * Midnight-to-midnight window for the calendar day containing `ref` (server
 * local time). `start` is inclusive, `end` exclusive.
 */
export function getMatchDateRange(ref: Date = new Date()): DateRange {
  const start = new Date(ref.getFullYear(), ref.getMonth(), ref.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export type MatchDay = "today" | "previous" | "upcoming";

/** Which day-bucket a kickoff falls into relative to `range`. */
export function matchDay(
  kickoffAt: string | null,
  range: DateRange,
): MatchDay {
  if (!kickoffAt) return "upcoming";
  const t = new Date(kickoffAt).getTime();
  if (Number.isNaN(t)) return "upcoming";
  if (t < range.start.getTime()) return "previous";
  if (t >= range.end.getTime()) return "upcoming";
  return "today";
}

// ---------------------------------------------------------------------------
// Enriched matchups (fixtures + local teams + owners)
// ---------------------------------------------------------------------------
export interface MatchupSide {
  apiId: number | null;
  name: string | null;
  flag: string | null;
  logoUrl: string | null;
  /** Local `teams.id`, or null if this API team isn't in the pool. */
  localTeamId: string | null;
  owner: Player | null;
  goals: number | null;
  /** Outcome flags, only meaningful once the match is finished. */
  isWinner: boolean;
  isLoser: boolean;
}

export interface Matchup {
  fixtureId: string;
  apiFixtureId: number;
  kickoffAt: string | null;
  round: string | null;
  isKnockout: boolean;
  statusShort: string | null;
  statusLong: string | null;
  status: MappedStatus;
  venueName: string | null;
  venueCity: string | null;
  home: MatchupSide;
  away: MatchupSide;
  winnerApiId: number | null;
  loserApiId: number | null;
  isDraw: boolean;
  isFinished: boolean;
  includedInStandings: boolean;
}

export interface BuildMatchupsInput {
  fixtures: Fixture[];
  teams: Team[];
  assignments: TeamAssignment[];
  players: Player[];
}

/**
 * Join stored fixtures to the pool's local teams and the players who own them.
 *
 * Owner lookup follows: fixture team api id -> teams.api_football_team_id ->
 * team_assignments.team_id -> players.id. Any link that's missing (team not
 * synced, draw not run yet) simply yields a null owner. Sorted by kickoff.
 */
export function buildMatchups(input: BuildMatchupsInput): Matchup[] {
  const { fixtures, teams, assignments, players } = input;

  const playerById = new Map(players.map((p) => [p.id, p]));
  const ownerByTeamId = new Map<string, Player>();
  for (const a of assignments) {
    const player = playerById.get(a.player_id);
    if (player) ownerByTeamId.set(a.team_id, player);
  }
  const teamByApiId = new Map<number, Team>();
  for (const t of teams) {
    if (t.api_football_team_id != null) teamByApiId.set(t.api_football_team_id, t);
  }

  const side = (
    apiId: number | null,
    name: string | null,
    goals: number | null,
    winnerApiId: number | null,
    loserApiId: number | null,
  ): MatchupSide => {
    const team = apiId != null ? teamByApiId.get(apiId) ?? null : null;
    const owner = team ? ownerByTeamId.get(team.id) ?? null : null;
    return {
      apiId,
      name: team?.name ?? name,
      flag: team?.flag ?? null,
      logoUrl: team?.logo_url ?? null,
      localTeamId: team?.id ?? null,
      owner,
      goals,
      isWinner: apiId != null && apiId === winnerApiId,
      isLoser: apiId != null && apiId === loserApiId,
    };
  };

  return fixtures
    .map((f): Matchup => {
      const status = mapFixtureStatus(f.status_short, f.status_long);
      return {
        fixtureId: f.id,
        apiFixtureId: f.api_football_fixture_id,
        kickoffAt: f.kickoff_at,
        round: f.round,
        isKnockout: isKnockoutRound(normalizeRound(f.round)),
        statusShort: f.status_short,
        statusLong: f.status_long,
        status,
        venueName: f.venue_name,
        venueCity: f.venue_city,
        home: side(
          f.home_team_api_id,
          f.home_team_name,
          f.home_goals,
          f.winner_team_api_id,
          f.loser_team_api_id,
        ),
        away: side(
          f.away_team_api_id,
          f.away_team_name,
          f.away_goals,
          f.winner_team_api_id,
          f.loser_team_api_id,
        ),
        winnerApiId: f.winner_team_api_id,
        loserApiId: f.loser_team_api_id,
        isDraw: f.is_draw,
        isFinished: f.is_finished,
        includedInStandings: f.included_in_standings,
      };
    })
    .sort((a, b) => {
      const ta = a.kickoffAt ? new Date(a.kickoffAt).getTime() : 0;
      const tb = b.kickoffAt ? new Date(b.kickoffAt).getTime() : 0;
      return ta - tb;
    });
}

// ---------------------------------------------------------------------------
// Grouping helpers for the page
// ---------------------------------------------------------------------------
export interface SplitMatchups {
  today: Matchup[];
  previous: Matchup[];
  upcoming: Matchup[];
}

/** Bucket matchups into today / previous / upcoming relative to `ref`. */
export function splitMatchups(
  matchups: Matchup[],
  ref: Date = new Date(),
): SplitMatchups {
  const range = getMatchDateRange(ref);
  const out: SplitMatchups = { today: [], previous: [], upcoming: [] };
  for (const m of matchups) {
    out[matchDay(m.kickoffAt, range)].push(m);
  }
  // Previous reads best newest-first.
  out.previous.reverse();
  return out;
}

export interface TodaySections {
  live: Matchup[];
  upcoming: Matchup[];
  completed: Matchup[];
}

/** Split today's matchups into Live / Upcoming / Completed sections. */
export function todaySections(matchups: Matchup[]): TodaySections {
  const out: TodaySections = { live: [], upcoming: [], completed: [] };
  for (const m of matchups) {
    if (m.status.category === "live") out.live.push(m);
    else if (m.status.category === "finished") out.completed.push(m);
    else out.upcoming.push(m);
  }
  return out;
}

export type RoundFilter = "all" | "group" | "knockout";

/** Apply the round + "my teams" filters used by the page controls. */
export function filterMatchups(
  matchups: Matchup[],
  opts: { round?: RoundFilter; playerId?: string | null },
): Matchup[] {
  const round = opts.round ?? "all";
  const playerId = opts.playerId || null;
  return matchups.filter((m) => {
    if (round === "group" && m.isKnockout) return false;
    if (round === "knockout" && !m.isKnockout) return false;
    if (playerId) {
      const owns =
        m.home.owner?.id === playerId || m.away.owner?.id === playerId;
      if (!owns) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Pool impact (simple MVP text)
// ---------------------------------------------------------------------------
/**
 * Short, human lines describing how a FINISHED matchup moved the pool, based on
 * the pool's scoring rules. Empty for unfinished matches.
 */
export function poolImpact(matchup: Matchup, rules: ScoringRule[]): string[] {
  if (!matchup.isFinished) return [];
  const ruleMap = rulesToMap(rules);
  const lines: string[] = [];

  const ownerLabel = (side: MatchupSide): string =>
    side.owner ? `${side.owner.name}'s ${side.name ?? "team"}` : side.name ?? "Team";

  if (!matchup.isKnockout) {
    if (matchup.isDraw) {
      const pts = ruleMap.group_draw ?? 0;
      lines.push(`${ownerLabel(matchup.home)} earned +${pts} (group draw)`);
      lines.push(`${ownerLabel(matchup.away)} earned +${pts} (group draw)`);
    } else {
      const pts = ruleMap.group_win ?? 0;
      const winner = matchup.home.isWinner ? matchup.home : matchup.away;
      lines.push(`${ownerLabel(winner)} earned +${pts} (group win)`);
    }
    return lines;
  }

  // Knockout: the winner advances; report progression rather than a fixed delta
  // since round bonuses are awarded for the furthest stage reached overall.
  const winner = matchup.home.isWinner
    ? matchup.home
    : matchup.away.isWinner
      ? matchup.away
      : null;
  if (winner) {
    lines.push(`${ownerLabel(winner)} advanced — round bonus applies in standings`);
  } else {
    lines.push("Knockout result pending a decisive winner");
  }
  return lines;
}
