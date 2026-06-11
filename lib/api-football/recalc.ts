import type { Fixture, KnockoutStage } from "../types";
import type { InternalRound } from "./types";
import {
  isGroupRound,
  isKnockoutRound,
  knockoutRoundDepth,
  normalizeRound,
  roundToKnockoutStage,
} from "./rounds";

/**
 * Pure recalculation utilities.
 *
 * Every function here derives results FROM the stored fixtures rather than
 * incrementing counters, so running a sync twice can never double-count. They
 * take plain data (fixtures + an api-id -> local-team-id map) and return plain
 * data, which keeps them trivially unit-testable with no database or network.
 */

/** Only the fixture fields the recalculation actually depends on. */
export type FixtureLike = Pick<
  Fixture,
  | "round"
  | "is_finished"
  | "home_team_api_id"
  | "away_team_api_id"
  | "home_goals"
  | "away_goals"
  | "winner_team_api_id"
>;

export interface GroupRecord {
  group_wins: number;
  group_draws: number;
  group_losses: number;
}

function emptyRecord(): GroupRecord {
  return { group_wins: 0, group_draws: 0, group_losses: 0 };
}

/** Outcome of a finished match decided purely by goals. */
export type MatchOutcome = "home" | "away" | "draw";

export function matchOutcome(
  homeGoals: number | null,
  awayGoals: number | null,
): MatchOutcome | null {
  if (homeGoals === null || awayGoals === null) return null;
  if (homeGoals > awayGoals) return "home";
  if (awayGoals > homeGoals) return "away";
  return "draw";
}

/**
 * Recompute every team's group-stage W/D/L from all FINISHED group fixtures.
 * Returns a map keyed by LOCAL team id; teams with no finished group games are
 * simply absent. Unmapped API teams (not in this pool) are skipped.
 */
export function recalcGroupRecords(
  fixtures: FixtureLike[],
  apiIdToTeamId: Map<number, string>,
): Map<string, GroupRecord> {
  const records = new Map<string, GroupRecord>();
  const bump = (teamId: string, key: keyof GroupRecord) => {
    const rec = records.get(teamId) ?? emptyRecord();
    rec[key] += 1;
    records.set(teamId, rec);
  };

  for (const fx of fixtures) {
    if (!fx.is_finished) continue;
    if (!isGroupRound(normalizeRound(fx.round))) continue;

    const homeId =
      fx.home_team_api_id != null ? apiIdToTeamId.get(fx.home_team_api_id) : undefined;
    const awayId =
      fx.away_team_api_id != null ? apiIdToTeamId.get(fx.away_team_api_id) : undefined;
    if (!homeId || !awayId) continue;

    const outcome = matchOutcome(fx.home_goals, fx.away_goals);
    if (outcome === null) continue;

    if (outcome === "draw") {
      bump(homeId, "group_draws");
      bump(awayId, "group_draws");
    } else if (outcome === "home") {
      bump(homeId, "group_wins");
      bump(awayId, "group_losses");
    } else {
      bump(awayId, "group_wins");
      bump(homeId, "group_losses");
    }
  }

  return records;
}

/**
 * Recompute the furthest knockout stage each team reached.
 *
 * A team "reaches" a round by appearing in one of its fixtures. The furthest
 * round (by depth) wins. The final is special: once it's finished, the winner
 * becomes Champion and the other finalist Runner-up; an unfinished final leaves
 * both finalists as Runner-up (reaching the final guarantees at least that).
 *
 * The 3rd-place match is ignored for depth, so its teams keep their Semifinal
 * standing. Returns a map keyed by LOCAL team id (only teams that reached a
 * knockout round appear).
 */
export function recalcKnockoutStages(
  fixtures: FixtureLike[],
  apiIdToTeamId: Map<number, string>,
): Map<string, KnockoutStage> {
  const deepestRound = new Map<string, InternalRound>();
  let finishedFinal: FixtureLike | null = null;

  const consider = (teamId: string, round: InternalRound) => {
    const current = deepestRound.get(teamId);
    if (!current || knockoutRoundDepth(round) > knockoutRoundDepth(current)) {
      deepestRound.set(teamId, round);
    }
  };

  for (const fx of fixtures) {
    const round = normalizeRound(fx.round);
    if (!isKnockoutRound(round)) continue;

    const homeId =
      fx.home_team_api_id != null ? apiIdToTeamId.get(fx.home_team_api_id) : undefined;
    const awayId =
      fx.away_team_api_id != null ? apiIdToTeamId.get(fx.away_team_api_id) : undefined;
    if (homeId) consider(homeId, round);
    if (awayId) consider(awayId, round);

    if (round === "final" && fx.is_finished) finishedFinal = fx;
  }

  const stages = new Map<string, KnockoutStage>();
  for (const [teamId, round] of deepestRound) {
    stages.set(teamId, roundToKnockoutStage(round));
  }

  // Crown the champion once the final is decided.
  if (finishedFinal) {
    const winnerApiId = finishedFinal.winner_team_api_id;
    const homeId =
      finishedFinal.home_team_api_id != null
        ? apiIdToTeamId.get(finishedFinal.home_team_api_id)
        : undefined;
    const awayId =
      finishedFinal.away_team_api_id != null
        ? apiIdToTeamId.get(finishedFinal.away_team_api_id)
        : undefined;
    const winnerId =
      winnerApiId != null ? apiIdToTeamId.get(winnerApiId) : undefined;

    if (homeId) stages.set(homeId, homeId === winnerId ? "champion" : "runner_up");
    if (awayId) stages.set(awayId, awayId === winnerId ? "champion" : "runner_up");
  }

  return stages;
}

export interface RecalculatedResult {
  teamId: string;
  group_wins: number;
  group_draws: number;
  group_losses: number;
  knockout_stage: KnockoutStage;
}

/**
 * Combine group records and knockout stages into one row per team that has any
 * result. This is what the sync writes back into `team_results`.
 */
export function recalcTeamResults(
  fixtures: FixtureLike[],
  apiIdToTeamId: Map<number, string>,
): RecalculatedResult[] {
  const groups = recalcGroupRecords(fixtures, apiIdToTeamId);
  const knockouts = recalcKnockoutStages(fixtures, apiIdToTeamId);

  const teamIds = new Set<string>([...groups.keys(), ...knockouts.keys()]);
  const results: RecalculatedResult[] = [];
  for (const teamId of teamIds) {
    const g = groups.get(teamId) ?? emptyRecord();
    results.push({
      teamId,
      group_wins: g.group_wins,
      group_draws: g.group_draws,
      group_losses: g.group_losses,
      knockout_stage: knockouts.get(teamId) ?? "none",
    });
  }
  return results;
}
