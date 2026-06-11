import type { InternalRound } from "./types";
import type { KnockoutStage } from "../types";

/**
 * Round-name normalization.
 *
 * API-Football's `league.round` is free text and varies in formatting:
 *   "Group Stage - 1", "Round of 32", "8th Finals", "Quarter-finals",
 *   "Semi-finals", "3rd Place Final", "Final - 1", ...
 *
 * We map all of that onto a small, stable set of `InternalRound` values so the
 * recalculation logic never has to string-match raw API output.
 *
 * This module is PURE (no I/O) so it can be unit-tested in isolation.
 */
export function normalizeRound(raw: string | null | undefined): InternalRound {
  if (!raw) return "unknown";
  const s = raw.toLowerCase();

  if (s.includes("group")) return "group";
  if (s.includes("round of 32") || s.includes("1/16")) return "r32";
  if (
    s.includes("round of 16") ||
    s.includes("8th finals") ||
    s.includes("1/8")
  )
    return "r16";
  if (s.includes("quarter") || s.includes("1/4")) return "qf";
  // Semi must be checked before "final" so "Semi-finals" isn't read as a final.
  if (s.includes("semi") || s.includes("1/2")) return "sf";
  if (s.includes("3rd place") || s.includes("third place")) return "third_place";
  if (s.includes("final")) return "final";

  return "unknown";
}

export function isGroupRound(round: InternalRound): boolean {
  return round === "group";
}

/** True for any single-elimination round (everything past the group stage). */
export function isKnockoutRound(round: InternalRound): boolean {
  return (
    round === "r32" ||
    round === "r16" ||
    round === "qf" ||
    round === "sf" ||
    round === "final"
  );
}

/**
 * How "far" a knockout round is. Higher = further. The 3rd-place match and
 * unknown rounds are deliberately excluded (return -1) so they never count as
 * the furthest round a team reached.
 */
export function knockoutRoundDepth(round: InternalRound): number {
  switch (round) {
    case "r32":
      return 1;
    case "r16":
      return 2;
    case "qf":
      return 3;
    case "sf":
      return 4;
    case "final":
      return 5;
    default:
      return -1;
  }
}

/**
 * Map a non-final knockout round to the app's `KnockoutStage` (the "reached"
 * value). The final is handled separately because the winner/loser distinction
 * needs the fixture result, so this maps it to "runner_up" as a safe default.
 */
export function roundToKnockoutStage(round: InternalRound): KnockoutStage {
  switch (round) {
    case "r32":
      return "r32";
    case "r16":
      return "r16";
    case "qf":
      return "qf";
    case "sf":
      return "sf";
    case "final":
      return "runner_up";
    default:
      return "none";
  }
}
