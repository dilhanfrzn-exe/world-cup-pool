import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeRound,
  isGroupRound,
  isKnockoutRound,
  knockoutRoundDepth,
  roundToKnockoutStage,
} from "../rounds";

test("normalizeRound maps API round strings to internal rounds", () => {
  assert.equal(normalizeRound("Group Stage - 1"), "group");
  assert.equal(normalizeRound("Group A"), "group");
  assert.equal(normalizeRound("Round of 32"), "r32");
  assert.equal(normalizeRound("Round of 16"), "r16");
  assert.equal(normalizeRound("8th Finals"), "r16");
  assert.equal(normalizeRound("Quarter-finals"), "qf");
  assert.equal(normalizeRound("Semi-finals"), "sf");
  assert.equal(normalizeRound("3rd Place Final"), "third_place");
  assert.equal(normalizeRound("Final"), "final");
  assert.equal(normalizeRound("Final - 1"), "final");
});

test("normalizeRound is resilient to casing/whitespace and unknowns", () => {
  assert.equal(normalizeRound("  ROUND OF 16  "), "r16");
  assert.equal(normalizeRound(null), "unknown");
  assert.equal(normalizeRound(""), "unknown");
  assert.equal(normalizeRound("Friendlies"), "unknown");
});

test("semi-finals is not misread as the final", () => {
  assert.equal(normalizeRound("Semi-finals"), "sf");
  assert.notEqual(normalizeRound("Semi-finals"), "final");
});

test("group vs knockout classification", () => {
  assert.ok(isGroupRound(normalizeRound("Group Stage - 2")));
  assert.ok(isKnockoutRound(normalizeRound("Quarter-finals")));
  assert.ok(!isKnockoutRound(normalizeRound("Group Stage - 2")));
  assert.ok(!isKnockoutRound(normalizeRound("3rd Place Final")));
});

test("knockout depth orders rounds and excludes 3rd place/unknown", () => {
  assert.ok(knockoutRoundDepth("r16") > knockoutRoundDepth("r32"));
  assert.ok(knockoutRoundDepth("final") > knockoutRoundDepth("sf"));
  assert.equal(knockoutRoundDepth("third_place"), -1);
  assert.equal(knockoutRoundDepth("group"), -1);
});

test("roundToKnockoutStage maps rounds to reached stages", () => {
  assert.equal(roundToKnockoutStage("r32"), "r32");
  assert.equal(roundToKnockoutStage("qf"), "qf");
  assert.equal(roundToKnockoutStage("final"), "runner_up");
  assert.equal(roundToKnockoutStage("group"), "none");
});
