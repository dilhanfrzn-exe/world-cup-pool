import type { KnockoutStage, ScoringRule, TeamResult } from "./types";

/**
 * Default scoring rules. These are seeded into `scoring_rules` for every new
 * pool so a host can later tweak them per pool without code changes.
 */
export const DEFAULT_SCORING_RULES: { key: string; label: string; points: number }[] =
  [
    { key: "group_win", label: "Group stage win", points: 3 },
    { key: "group_draw", label: "Group stage draw", points: 1 },
    { key: "r32", label: "Reached Round of 32", points: 5 },
    { key: "r16", label: "Reached Round of 16", points: 10 },
    { key: "qf", label: "Reached Quarterfinal", points: 20 },
    { key: "sf", label: "Reached Semifinal", points: 30 },
    { key: "runner_up", label: "Runner-up", points: 40 },
    { key: "champion", label: "Champion", points: 60 },
  ];

export const KNOCKOUT_STAGES: { value: KnockoutStage; label: string }[] = [
  { value: "none", label: "Group stage / eliminated" },
  { value: "r32", label: "Round of 32" },
  { value: "r16", label: "Round of 16" },
  { value: "qf", label: "Quarterfinal" },
  { value: "sf", label: "Semifinal" },
  { value: "runner_up", label: "Runner-up" },
  { value: "champion", label: "Champion" },
];

export function knockoutLabel(stage: KnockoutStage): string {
  return KNOCKOUT_STAGES.find((s) => s.value === stage)?.label ?? "Group stage";
}

/** Build a quick lookup map from a list of scoring rules. */
export function rulesToMap(rules: ScoringRule[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const r of rules) map[r.rule_key] = r.points;
  // Fall back to defaults for any missing keys.
  for (const d of DEFAULT_SCORING_RULES) {
    if (map[d.key] === undefined) map[d.key] = d.points;
  }
  return map;
}

/** Points earned by a single team given a result row and scoring rules. */
export function teamPoints(
  result:
    | Pick<
        TeamResult,
        | "group_wins"
        | "group_draws"
        | "knockout_stage"
        | "manual_points_override"
      >
    | null
    | undefined,
  rules: Record<string, number>,
): number {
  if (!result) return 0;
  // A host-set fixed total wins over computed scoring (custom/corrected scores).
  if (
    result.manual_points_override !== undefined &&
    result.manual_points_override !== null
  ) {
    return result.manual_points_override;
  }
  const groupPoints =
    result.group_wins * (rules.group_win ?? 0) +
    result.group_draws * (rules.group_draw ?? 0);
  const knockoutPoints =
    result.knockout_stage && result.knockout_stage !== "none"
      ? rules[result.knockout_stage] ?? 0
      : 0;
  return groupPoints + knockoutPoints;
}
