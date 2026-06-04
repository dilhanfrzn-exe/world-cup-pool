import type {
  Player,
  ScoringRule,
  Team,
  TeamAssignment,
  TeamResult,
} from "./types";
import { rulesToMap, teamPoints } from "./scoring";

export interface PlayerTeam extends Team {
  points: number;
}

export interface StandingRow {
  player: Player;
  teams: PlayerTeam[];
  totalPoints: number;
  rank: number;
}

export interface RoomData {
  players: Player[];
  teams: Team[];
  assignments: TeamAssignment[];
  results: TeamResult[];
  rules: ScoringRule[];
}

/**
 * Compute the full leaderboard from the raw tables. Standings are derived in
 * code (not the SQL view) so per-pool scoring overrides are respected.
 */
export function computeStandings(data: RoomData): StandingRow[] {
  const ruleMap = rulesToMap(data.rules);

  const resultByTeam = new Map<string, TeamResult>();
  for (const r of data.results) resultByTeam.set(r.team_id, r);

  const teamById = new Map<string, Team>();
  for (const t of data.teams) teamById.set(t.id, t);

  const teamsByPlayer = new Map<string, PlayerTeam[]>();
  for (const a of data.assignments) {
    const team = teamById.get(a.team_id);
    if (!team) continue;
    const points = teamPoints(resultByTeam.get(a.team_id), ruleMap);
    const list = teamsByPlayer.get(a.player_id) ?? [];
    list.push({ ...team, points });
    teamsByPlayer.set(a.player_id, list);
  }

  const rows: Omit<StandingRow, "rank">[] = data.players.map((player) => {
    const teams = (teamsByPlayer.get(player.id) ?? []).sort(
      (a, b) => b.points - a.points || a.tier - b.tier,
    );
    const totalPoints = teams.reduce((sum, t) => sum + t.points, 0);
    return { player, teams, totalPoints };
  });

  rows.sort(
    (a, b) =>
      b.totalPoints - a.totalPoints ||
      a.player.name.localeCompare(b.player.name),
  );

  // Assign ranks with ties sharing the same rank.
  let lastPoints: number | null = null;
  let lastRank = 0;
  return rows.map((row, i) => {
    const rank = row.totalPoints === lastPoints ? lastRank : i + 1;
    lastPoints = row.totalPoints;
    lastRank = rank;
    return { ...row, rank };
  });
}
