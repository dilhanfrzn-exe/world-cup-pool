import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMatchups,
  determineFixtureResult,
  filterMatchups,
  getMatchDateRange,
  mapFixtureStatus,
  matchDay,
  poolImpact,
  splitMatchups,
  todaySections,
} from "../../matchups";
import type {
  Fixture,
  Player,
  ScoringRule,
  Team,
  TeamAssignment,
} from "../../types";

// --- determineFixtureResult -------------------------------------------------
test("determineFixtureResult: unfinished match has no winner/loser/draw", () => {
  const r = determineFixtureResult({
    statusShort: "NS",
    homeApiId: 1,
    awayApiId: 2,
    homeGoals: null,
    awayGoals: null,
  });
  assert.deepEqual(r, {
    isFinished: false,
    isDraw: false,
    winnerApiId: null,
    loserApiId: null,
  });
});

test("determineFixtureResult: home win by goals", () => {
  const r = determineFixtureResult({
    statusShort: "FT",
    homeApiId: 1,
    awayApiId: 2,
    homeGoals: 2,
    awayGoals: 1,
  });
  assert.equal(r.winnerApiId, 1);
  assert.equal(r.loserApiId, 2);
  assert.equal(r.isDraw, false);
});

test("determineFixtureResult: away win by goals", () => {
  const r = determineFixtureResult({
    statusShort: "FT",
    homeApiId: 1,
    awayApiId: 2,
    homeGoals: 0,
    awayGoals: 3,
  });
  assert.equal(r.winnerApiId, 2);
  assert.equal(r.loserApiId, 1);
});

test("determineFixtureResult: group draw is a draw, no winner", () => {
  const r = determineFixtureResult({
    statusShort: "FT",
    homeApiId: 1,
    awayApiId: 2,
    homeGoals: 1,
    awayGoals: 1,
  });
  assert.equal(r.isDraw, true);
  assert.equal(r.winnerApiId, null);
  assert.equal(r.loserApiId, null);
});

test("determineFixtureResult: penalties use winner hint, not a draw", () => {
  const r = determineFixtureResult({
    statusShort: "PEN",
    homeApiId: 1,
    awayApiId: 2,
    homeGoals: 1,
    awayGoals: 1,
    winnerHint: 2,
  });
  assert.equal(r.isDraw, false);
  assert.equal(r.winnerApiId, 2);
  assert.equal(r.loserApiId, 1);
});

// --- mapFixtureStatus -------------------------------------------------------
test("mapFixtureStatus: categories", () => {
  assert.equal(mapFixtureStatus("NS").category, "upcoming");
  assert.equal(mapFixtureStatus("1H").category, "live");
  assert.equal(mapFixtureStatus("HT").category, "live");
  assert.equal(mapFixtureStatus("FT").category, "finished");
  assert.equal(mapFixtureStatus("PEN").category, "finished");
  assert.equal(mapFixtureStatus("PST").category, "postponed");
  assert.equal(mapFixtureStatus("CANC").category, "cancelled");
  assert.equal(mapFixtureStatus("???").category, "unknown");
});

test("mapFixtureStatus: prefers statusLong for label", () => {
  assert.equal(mapFixtureStatus("FT", "Match Finished").label, "Match Finished");
  assert.equal(mapFixtureStatus("NS").label, "Not started");
});

// --- date windows -----------------------------------------------------------
test("getMatchDateRange + matchDay bucket relative to ref", () => {
  const ref = new Date(2026, 5, 10, 14, 0, 0); // Jun 10 2026, 2pm local
  const range = getMatchDateRange(ref);
  const today = new Date(2026, 5, 10, 18, 0, 0).toISOString();
  const yesterday = new Date(2026, 5, 9, 18, 0, 0).toISOString();
  const tomorrow = new Date(2026, 5, 11, 9, 0, 0).toISOString();
  assert.equal(matchDay(today, range), "today");
  assert.equal(matchDay(yesterday, range), "previous");
  assert.equal(matchDay(tomorrow, range), "upcoming");
  assert.equal(matchDay(null, range), "upcoming");
});

// --- buildMatchups + owners -------------------------------------------------
const ARG = 26;
const JPN = 12;

function fixture(over: Partial<Fixture>): Fixture {
  return {
    id: "fx-1",
    pool_id: "pool-1",
    api_football_fixture_id: 1001,
    league_id: 1,
    season: 2026,
    round: "Group Stage - 1",
    status_short: "FT",
    status_long: "Match Finished",
    kickoff_at: new Date(2026, 5, 10, 12, 0, 0).toISOString(),
    venue_name: "Stadium",
    venue_city: "City",
    home_team_api_id: ARG,
    away_team_api_id: JPN,
    home_team_name: "Argentina",
    away_team_name: "Japan",
    home_goals: 2,
    away_goals: 1,
    winner_team_api_id: ARG,
    loser_team_api_id: JPN,
    is_draw: false,
    is_finished: true,
    included_in_standings: true,
    last_synced_at: null,
    created_at: "",
    updated_at: "",
    ...over,
  };
}

function team(id: string, apiId: number, name: string): Team {
  return {
    id,
    pool_id: "pool-1",
    name,
    country_code: null,
    tier: 1,
    flag: "🏳️",
    api_football_team_id: apiId,
    logo_url: null,
    last_synced_at: null,
    created_at: "",
  };
}

function player(id: string, name: string): Player {
  return {
    id,
    pool_id: "pool-1",
    user_id: null,
    name,
    nickname: null,
    paid: false,
    created_at: "",
  };
}

const teams = [team("t-arg", ARG, "Argentina"), team("t-jpn", JPN, "Japan")];
const players = [player("p-dil", "Dilhan"), player("p-chris", "Chris")];
const assignments: TeamAssignment[] = [
  { id: "a1", pool_id: "pool-1", team_id: "t-arg", player_id: "p-dil", created_at: "" },
  { id: "a2", pool_id: "pool-1", team_id: "t-jpn", player_id: "p-chris", created_at: "" },
];

test("buildMatchups resolves owners + winner/loser flags", () => {
  const [m] = buildMatchups({ fixtures: [fixture({})], teams, assignments, players });
  assert.equal(m.home.name, "Argentina");
  assert.equal(m.home.owner?.name, "Dilhan");
  assert.equal(m.away.owner?.name, "Chris");
  assert.equal(m.home.isWinner, true);
  assert.equal(m.away.isLoser, true);
  assert.equal(m.isKnockout, false);
});

test("buildMatchups leaves owner null when team not assigned", () => {
  const [m] = buildMatchups({
    fixtures: [fixture({})],
    teams,
    assignments: [],
    players,
  });
  assert.equal(m.home.owner, null);
  assert.equal(m.away.owner, null);
});

test("splitMatchups + todaySections group correctly", () => {
  const ref = new Date(2026, 5, 10, 14, 0, 0);
  const fixtures = [
    fixture({ id: "live", status_short: "1H", is_finished: false, kickoff_at: new Date(2026, 5, 10, 13, 30).toISOString() }),
    fixture({ id: "done", status_short: "FT", is_finished: true, kickoff_at: new Date(2026, 5, 10, 9, 0).toISOString() }),
    fixture({ id: "soon", status_short: "NS", is_finished: false, kickoff_at: new Date(2026, 5, 10, 20, 0).toISOString() }),
    fixture({ id: "past", status_short: "FT", is_finished: true, kickoff_at: new Date(2026, 5, 8, 12, 0).toISOString() }),
    fixture({ id: "future", status_short: "NS", is_finished: false, kickoff_at: new Date(2026, 5, 12, 12, 0).toISOString() }),
  ];
  const all = buildMatchups({ fixtures, teams, assignments, players });
  const split = splitMatchups(all, ref);
  assert.equal(split.today.length, 3);
  assert.equal(split.previous.length, 1);
  assert.equal(split.upcoming.length, 1);

  const sections = todaySections(split.today);
  assert.equal(sections.live.length, 1);
  assert.equal(sections.completed.length, 1);
  assert.equal(sections.upcoming.length, 1);
});

test("filterMatchups by round and player", () => {
  const fixtures = [
    fixture({ id: "grp", round: "Group Stage - 1" }),
    fixture({ id: "ko", round: "Round of 16" }),
  ];
  const all = buildMatchups({ fixtures, teams, assignments, players });
  assert.equal(filterMatchups(all, { round: "group" }).length, 1);
  assert.equal(filterMatchups(all, { round: "knockout" }).length, 1);
  assert.equal(filterMatchups(all, { round: "all" }).length, 2);
  assert.equal(filterMatchups(all, { playerId: "p-dil" }).length, 2);
  assert.equal(filterMatchups(all, { playerId: "nobody" }).length, 0);
});

// --- poolImpact -------------------------------------------------------------
const rules: ScoringRule[] = [
  { id: "r1", pool_id: "pool-1", rule_key: "group_win", points: 3, created_at: "" },
  { id: "r2", pool_id: "pool-1", rule_key: "group_draw", points: 1, created_at: "" },
];

test("poolImpact: group win awards winner", () => {
  const [m] = buildMatchups({ fixtures: [fixture({})], teams, assignments, players });
  const lines = poolImpact(m, rules);
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Dilhan/);
  assert.match(lines[0], /\+3/);
});

test("poolImpact: group draw awards both", () => {
  const drawFx = fixture({
    home_goals: 1,
    away_goals: 1,
    winner_team_api_id: null,
    loser_team_api_id: null,
    is_draw: true,
  });
  const [m] = buildMatchups({ fixtures: [drawFx], teams, assignments, players });
  const lines = poolImpact(m, rules);
  assert.equal(lines.length, 2);
  assert.ok(lines.every((l) => /\+1/.test(l)));
});

test("poolImpact: empty for unfinished match", () => {
  const ns = fixture({ status_short: "NS", is_finished: false });
  const [m] = buildMatchups({ fixtures: [ns], teams, assignments, players });
  assert.deepEqual(poolImpact(m, rules), []);
});
