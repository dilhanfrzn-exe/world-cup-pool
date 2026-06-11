import "server-only";

import { getServerSupabase } from "../supabase/server";
import type { Fixture, SyncStatus, Team, TeamResult } from "../types";
import {
  fetchWorldCupFixtures,
  fetchWorldCupTeams,
  fetchLiveWorldCupFixtures,
  isApiFootballConfigured,
  WORLD_CUP_LEAGUE_ID,
  WORLD_CUP_SEASON,
  ApiFootballError,
} from "./client";
import type { ApiFixture } from "./types";
import { buildNameLookup, matchApiTeamName } from "./team-match";
import { recalcTeamResults } from "./recalc";
import { determineFixtureResult } from "../matchups";

/**
 * Server-side orchestration for API-Football syncing. This is the only place
 * that talks to both the API and Supabase; the pure helpers it composes
 * (round mapping, team matching, result recalculation) live in sibling files
 * and are unit-tested independently.
 */

export interface SyncResult {
  status: SyncStatus;
  message: string;
  teamsMatched?: number;
  fixturesSynced?: number;
  resultsUpdated?: number;
}

// ---------------------------------------------------------------------------
// Step 3 — seed / link World Cup teams from API-Football
// ---------------------------------------------------------------------------
/**
 * Match each local team in the pool to its API-Football team id and store the
 * crest URL. Matching is by (alias-aware) name; unmatched teams are left as-is
 * and reported so the host can fix the name or add a manual override.
 */
export async function linkTeamsFromApi(poolId: string): Promise<{
  matched: number;
  unmatchedApi: string[];
  unmatchedLocal: string[];
}> {
  const supabase = getServerSupabase();
  const { data: teamRows, error } = await supabase
    .from("teams")
    .select("*")
    .eq("pool_id", poolId);
  if (error) throw error;
  const teams = (teamRows as Team[]) ?? [];
  if (teams.length === 0) {
    return { matched: 0, unmatchedApi: [], unmatchedLocal: [] };
  }

  const res = await fetchWorldCupTeams();
  const apiTeams = res.response.map((r) => r.team);

  const lookup = buildNameLookup(teams.map((t) => t.name));
  const teamByName = new Map(teams.map((t) => [t.name, t]));
  const now = new Date().toISOString();

  const matchedLocalNames = new Set<string>();
  const unmatchedApi: string[] = [];
  let matched = 0;

  for (const apiTeam of apiTeams) {
    const localName = matchApiTeamName(apiTeam.name, lookup);
    if (!localName) {
      unmatchedApi.push(apiTeam.name);
      continue;
    }
    const team = teamByName.get(localName);
    if (!team) continue;

    const { error: updateError } = await supabase
      .from("teams")
      .update({
        api_football_team_id: apiTeam.id,
        logo_url: apiTeam.logo ?? team.logo_url,
        last_synced_at: now,
      })
      .eq("id", team.id);
    if (updateError) throw updateError;
    matched += 1;
    matchedLocalNames.add(localName);
  }

  const unmatchedLocal = teams
    .map((t) => t.name)
    .filter((n) => !matchedLocalNames.has(n));

  return { matched, unmatchedApi, unmatchedLocal };
}

// ---------------------------------------------------------------------------
// Step 4 — sync fixtures from API-Football
// ---------------------------------------------------------------------------
function toFixtureRow(poolId: string, fx: ApiFixture, now: string) {
  // Prefer the API's explicit winner flag (covers extra-time / penalties).
  const winnerHint =
    fx.teams.home.winner === true
      ? fx.teams.home.id
      : fx.teams.away.winner === true
        ? fx.teams.away.id
        : null;

  const result = determineFixtureResult({
    statusShort: fx.fixture.status.short,
    homeApiId: fx.teams.home.id,
    awayApiId: fx.teams.away.id,
    homeGoals: fx.goals.home,
    awayGoals: fx.goals.away,
    winnerHint,
  });

  return {
    pool_id: poolId,
    api_football_fixture_id: fx.fixture.id,
    league_id: fx.league.id,
    season: fx.league.season,
    round: fx.league.round,
    status_short: fx.fixture.status.short,
    status_long: fx.fixture.status.long,
    kickoff_at: fx.fixture.date,
    venue_name: fx.fixture.venue?.name ?? null,
    venue_city: fx.fixture.venue?.city ?? null,
    home_team_api_id: fx.teams.home.id,
    away_team_api_id: fx.teams.away.id,
    home_team_name: fx.teams.home.name,
    away_team_name: fx.teams.away.name,
    home_goals: fx.goals.home,
    away_goals: fx.goals.away,
    winner_team_api_id: result.winnerApiId,
    loser_team_api_id: result.loserApiId,
    is_draw: result.isDraw,
    is_finished: result.isFinished,
    // Finished fixtures are what recalcAndWriteResults folds into standings.
    included_in_standings: result.isFinished,
    last_synced_at: now,
    updated_at: now,
  };
}

/**
 * Pull every World Cup fixture and upsert it for this pool (no duplicates,
 * thanks to the unique (pool_id, api_football_fixture_id) constraint).
 */
export async function syncFixtures(poolId: string): Promise<number> {
  const supabase = getServerSupabase();
  const res = await fetchWorldCupFixtures();
  const now = new Date().toISOString();

  const rows = res.response.map((fx) => toFixtureRow(poolId, fx, now));
  if (rows.length === 0) return 0;

  const { error } = await supabase
    .from("fixtures")
    .upsert(rows, { onConflict: "pool_id,api_football_fixture_id" });
  if (error) throw error;
  return rows.length;
}

// ---------------------------------------------------------------------------
// Step 5 — recalculate team results from stored fixtures
// ---------------------------------------------------------------------------
/**
 * Recompute group records + knockout progress for the pool from its stored
 * fixtures and write them into `team_results`. Teams with a manual override are
 * left untouched. Returns the number of team rows updated.
 */
export async function recalcAndWriteResults(poolId: string): Promise<number> {
  const supabase = getServerSupabase();

  const [teamsRes, fixturesRes, resultsRes] = await Promise.all([
    supabase.from("teams").select("*").eq("pool_id", poolId),
    supabase.from("fixtures").select("*").eq("pool_id", poolId),
    supabase.from("team_results").select("*").eq("pool_id", poolId),
  ]);
  if (teamsRes.error) throw teamsRes.error;
  if (fixturesRes.error) throw fixturesRes.error;
  if (resultsRes.error) throw resultsRes.error;

  const teams = (teamsRes.data as Team[]) ?? [];
  const fixtures = (fixturesRes.data as Fixture[]) ?? [];
  const existing = (resultsRes.data as TeamResult[]) ?? [];

  // Map API team id -> local team id for this pool.
  const apiIdToTeamId = new Map<number, string>();
  for (const t of teams) {
    if (t.api_football_team_id != null) {
      apiIdToTeamId.set(t.api_football_team_id, t.id);
    }
  }

  const overrideTeamIds = new Set(
    existing.filter((r) => r.manual_override_enabled).map((r) => r.team_id),
  );

  const recalculated = recalcTeamResults(fixtures, apiIdToTeamId);
  const now = new Date().toISOString();

  const rows = recalculated
    .filter((r) => !overrideTeamIds.has(r.teamId))
    .map((r) => ({
      pool_id: poolId,
      team_id: r.teamId,
      group_wins: r.group_wins,
      group_draws: r.group_draws,
      group_losses: r.group_losses,
      knockout_stage: r.knockout_stage,
      source: "api" as const,
      last_synced_at: now,
      updated_at: now,
    }));

  if (rows.length > 0) {
    const { error } = await supabase
      .from("team_results")
      .upsert(rows, { onConflict: "pool_id,team_id" });
    if (error) throw error;
  }
  return rows.length;
}

// ---------------------------------------------------------------------------
// Full sync — the pipeline behind the "Sync World Cup Results" button / cron
// ---------------------------------------------------------------------------
export async function syncWorldCupResults(
  poolId: string,
  syncType = "manual",
): Promise<SyncResult> {
  const supabase = getServerSupabase();

  if (!isApiFootballConfigured()) {
    return {
      status: "error",
      message:
        "API-Football isn't configured. Set API_FOOTBALL_KEY to enable syncing.",
    };
  }

  // Open a log row so we have an audit trail even if the run crashes.
  const startedAt = new Date().toISOString();
  const { data: logRow } = await supabase
    .from("api_sync_logs")
    .insert({ pool_id: poolId, sync_type: syncType, status: "running" })
    .select("id")
    .single();
  const logId = (logRow as { id: string } | null)?.id;

  const finish = async (
    status: SyncStatus,
    message: string,
  ): Promise<void> => {
    if (!logId) return;
    await supabase
      .from("api_sync_logs")
      .update({ status, message, completed_at: new Date().toISOString() })
      .eq("id", logId);
  };

  try {
    const link = await linkTeamsFromApi(poolId);
    const fixturesSynced = await syncFixtures(poolId);
    const resultsUpdated = await recalcAndWriteResults(poolId);

    // Flip the pool to "active" once we have real fixture data, mirroring the
    // manual results flow.
    if (fixturesSynced > 0) {
      await supabase.from("pools").update({ status: "active" }).eq("id", poolId);
    }

    const notes: string[] = [
      `Linked ${link.matched} teams`,
      `synced ${fixturesSynced} fixtures`,
      `updated ${resultsUpdated} results`,
    ];
    // A successful run that couldn't match some teams is "partial" so the host
    // knows to check names / add overrides.
    const partial =
      fixturesSynced === 0 || link.unmatchedLocal.length > 0;
    if (link.unmatchedLocal.length > 0) {
      notes.push(`unmatched teams: ${link.unmatchedLocal.join(", ")}`);
    }
    if (fixturesSynced === 0) notes.push("no fixtures found yet");

    const message = notes.join("; ") + ".";
    const status: SyncStatus = partial ? "partial" : "success";
    await finish(status, message);
    return {
      status,
      message,
      teamsMatched: link.matched,
      fixturesSynced,
      resultsUpdated,
    };
  } catch (e) {
    const message =
      e instanceof ApiFootballError
        ? e.message
        : `Sync failed: ${(e as Error).message}`;
    await finish("error", message);
    return { status: "error", message };
  }
}

// ---------------------------------------------------------------------------
// Step 12 — live matches (structure only; not wired into standings for MVP)
// ---------------------------------------------------------------------------
export interface LiveMatch {
  fixtureId: number;
  round: string | null;
  statusShort: string | null;
  minute: number | null;
  home: { id: number; name: string; logo: string | null; goals: number | null };
  away: { id: number; name: string; logo: string | null; goals: number | null };
}

/** Fetch currently in-play World Cup matches for future live cards. */
export async function getLiveMatches(): Promise<LiveMatch[]> {
  const res = await fetchLiveWorldCupFixtures();
  return res.response.map((fx) => ({
    fixtureId: fx.fixture.id,
    round: fx.league.round,
    statusShort: fx.fixture.status.short,
    minute: fx.fixture.status.elapsed,
    home: {
      id: fx.teams.home.id,
      name: fx.teams.home.name,
      logo: fx.teams.home.logo,
      goals: fx.goals.home,
    },
    away: {
      id: fx.teams.away.id,
      name: fx.teams.away.name,
      logo: fx.teams.away.logo,
      goals: fx.goals.away,
    },
  }));
}

export { WORLD_CUP_LEAGUE_ID, WORLD_CUP_SEASON };
