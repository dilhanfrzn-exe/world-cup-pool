import { test } from "node:test";
import assert from "node:assert/strict";
import {
  matchOutcome,
  recalcGroupRecords,
  recalcKnockoutStages,
  recalcTeamResults,
  type FixtureLike,
} from "../recalc";

// API team ids -> local team ids used across the tests.
const ARG = 26;
const FRA = 2;
const BRA = 6;
const ESP = 9;
const apiIdToTeamId = new Map<number, string>([
  [ARG, "t-arg"],
  [FRA, "t-fra"],
  [BRA, "t-bra"],
  [ESP, "t-esp"],
]);

function group(
  home: number,
  away: number,
  hg: number | null,
  ag: number | null,
  finished = true,
): FixtureLike {
  return {
    round: "Group Stage - 1",
    is_finished: finished,
    home_team_api_id: home,
    away_team_api_id: away,
    home_goals: hg,
    away_goals: ag,
    winner_team_api_id: null,
  };
}

function ko(
  round: string,
  home: number,
  away: number,
  winner: number | null,
  finished = true,
): FixtureLike {
  return {
    round,
    is_finished: finished,
    home_team_api_id: home,
    away_team_api_id: away,
    home_goals: winner === null ? 1 : winner === home ? 2 : 1,
    away_goals: winner === null ? 1 : winner === away ? 2 : 1,
    winner_team_api_id: winner,
  };
}

test("matchOutcome decides by goals, null when unplayed", () => {
  assert.equal(matchOutcome(2, 1), "home");
  assert.equal(matchOutcome(0, 3), "away");
  assert.equal(matchOutcome(1, 1), "draw");
  assert.equal(matchOutcome(null, 1), null);
});

test("group records: win/draw/loss tallied for both teams", () => {
  const fixtures = [
    group(ARG, FRA, 2, 1), // ARG win, FRA loss
    group(ARG, BRA, 1, 1), // draw
    group(FRA, BRA, 0, 3), // BRA win, FRA loss
  ];
  const recs = recalcGroupRecords(fixtures, apiIdToTeamId);
  assert.deepEqual(recs.get("t-arg"), {
    group_wins: 1,
    group_draws: 1,
    group_losses: 0,
  });
  assert.deepEqual(recs.get("t-fra"), {
    group_wins: 0,
    group_draws: 0,
    group_losses: 2,
  });
  assert.deepEqual(recs.get("t-bra"), {
    group_wins: 1,
    group_draws: 1,
    group_losses: 0,
  });
});

test("group records ignore unfinished games and fixtures with unmapped teams", () => {
  const fixtures = [
    group(ARG, FRA, 2, 1, false), // not finished -> ignored
    group(ARG, FRA, 3, 0), // finished -> ARG win, FRA loss
    group(ARG, 999, 5, 0), // opponent not in pool -> whole fixture skipped
  ];
  const recs = recalcGroupRecords(fixtures, apiIdToTeamId);
  assert.deepEqual(recs.get("t-arg"), {
    group_wins: 1,
    group_draws: 0,
    group_losses: 0,
  });
  assert.deepEqual(recs.get("t-fra"), {
    group_wins: 0,
    group_draws: 0,
    group_losses: 1,
  });
});

test("running recalc twice is idempotent (no double counting)", () => {
  const fixtures = [group(ARG, FRA, 2, 1)];
  const a = recalcGroupRecords(fixtures, apiIdToTeamId);
  const b = recalcGroupRecords(fixtures, apiIdToTeamId);
  assert.deepEqual(a.get("t-arg"), b.get("t-arg"));
  assert.equal(a.get("t-arg")?.group_wins, 1);
});

test("knockout: furthest round reached wins; final crowns champion", () => {
  const fixtures = [
    ko("Round of 16", ARG, FRA, ARG), // FRA out at r16, ARG advances
    ko("Quarter-finals", ARG, BRA, ARG), // BRA out at qf, ARG advances
    ko("Semi-finals", ARG, ESP, ARG), // ESP out at sf, ARG advances
    ko("Final", ARG, FRA, ARG), // ARG champion, FRA runner-up
  ];
  const stages = recalcKnockoutStages(fixtures, apiIdToTeamId);
  assert.equal(stages.get("t-fra"), "runner_up"); // reached final this time
  assert.equal(stages.get("t-bra"), "qf");
  assert.equal(stages.get("t-esp"), "sf");
  assert.equal(stages.get("t-arg"), "champion");
});

test("knockout: unfinished final leaves both finalists as runner-up", () => {
  const fixtures = [ko("Final", ARG, FRA, null, false)];
  const stages = recalcKnockoutStages(fixtures, apiIdToTeamId);
  assert.equal(stages.get("t-arg"), "runner_up");
  assert.equal(stages.get("t-fra"), "runner_up");
});

test("knockout: 3rd place match does not override semifinal standing", () => {
  const fixtures = [
    ko("Semi-finals", BRA, ARG, ARG), // BRA loses semi
    ko("3rd Place Final", BRA, ESP, BRA), // BRA wins 3rd place
  ];
  const stages = recalcKnockoutStages(fixtures, apiIdToTeamId);
  assert.equal(stages.get("t-bra"), "sf");
});

test("recalcTeamResults combines group + knockout per team", () => {
  const fixtures = [
    group(ARG, FRA, 2, 1),
    ko("Round of 16", ARG, FRA, ARG),
  ];
  const results = recalcTeamResults(fixtures, apiIdToTeamId);
  const arg = results.find((r) => r.teamId === "t-arg");
  assert.ok(arg);
  assert.equal(arg?.group_wins, 1);
  assert.equal(arg?.knockout_stage, "r16");
});
