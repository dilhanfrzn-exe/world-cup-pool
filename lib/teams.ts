/**
 * Seed data: the 48 confirmed teams for the 2026 FIFA World Cup
 * (hosts USA/Canada/Mexico + qualifiers), split into 6 tiers of 8.
 *
 * Tiers here are a rough STRENGTH seeding (by approximate FIFA ranking) so the
 * tiered draw is fair and fun — they are not FIFA's official 4 pots of 12.
 * 48 teams across 6 even tiers means tiered draws divide evenly for pools of
 * 2, 4, or 8 players out of the box.
 *
 * `code` is an ISO-3166 alpha-2 code used to render a flag emoji. England and
 * Scotland both share "GB", so they set an explicit `flag` override.
 */

export interface SeedTeam {
  name: string;
  code: string;
  tier: number;
  /** Optional explicit flag emoji; falls back to one derived from `code`. */
  flag?: string;
}

/** Convert an ISO alpha-2 country code into its flag emoji. */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "\u{1F3F3}\u{FE0F}"; // white flag fallback
  const base = 127397; // regional indicator offset
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(base + c.charCodeAt(0)));
}

const ENGLAND_FLAG =
  "\u{1F3F4}\u{E0067}\u{E0062}\u{E0065}\u{E006E}\u{E0067}\u{E007F}";
const SCOTLAND_FLAG =
  "\u{1F3F4}\u{E0067}\u{E0062}\u{E0073}\u{E0063}\u{E0074}\u{E007F}";

export const WORLD_CUP_TEAMS: SeedTeam[] = [
  // Tier 1 — strongest
  { name: "Argentina", code: "AR", tier: 1 },
  { name: "Spain", code: "ES", tier: 1 },
  { name: "France", code: "FR", tier: 1 },
  { name: "England", code: "GB", tier: 1, flag: ENGLAND_FLAG },
  { name: "Brazil", code: "BR", tier: 1 },
  { name: "Portugal", code: "PT", tier: 1 },
  { name: "Netherlands", code: "NL", tier: 1 },
  { name: "Belgium", code: "BE", tier: 1 },

  // Tier 2 — strong
  { name: "Germany", code: "DE", tier: 2 },
  { name: "Croatia", code: "HR", tier: 2 },
  { name: "Morocco", code: "MA", tier: 2 },
  { name: "Colombia", code: "CO", tier: 2 },
  { name: "Uruguay", code: "UY", tier: 2 },
  { name: "Switzerland", code: "CH", tier: 2 },
  { name: "Japan", code: "JP", tier: 2 },
  { name: "United States", code: "US", tier: 2 },

  // Tier 3 — middle
  { name: "Senegal", code: "SN", tier: 3 },
  { name: "Iran", code: "IR", tier: 3 },
  { name: "Ecuador", code: "EC", tier: 3 },
  { name: "Austria", code: "AT", tier: 3 },
  { name: "Australia", code: "AU", tier: 3 },
  { name: "Norway", code: "NO", tier: 3 },
  { name: "Egypt", code: "EG", tier: 3 },
  { name: "Mexico", code: "MX", tier: 3 },

  // Tier 4 — lower
  { name: "Canada", code: "CA", tier: 4 },
  { name: "Türkiye", code: "TR", tier: 4 },
  { name: "South Korea", code: "KR", tier: 4 },
  { name: "Sweden", code: "SE", tier: 4 },
  { name: "Ivory Coast", code: "CI", tier: 4 },
  { name: "Tunisia", code: "TN", tier: 4 },
  { name: "Qatar", code: "QA", tier: 4 },
  { name: "Saudi Arabia", code: "SA", tier: 4 },

  // Tier 5 — underdogs
  { name: "Algeria", code: "DZ", tier: 5 },
  { name: "Scotland", code: "GB", tier: 5, flag: SCOTLAND_FLAG },
  { name: "Panama", code: "PA", tier: 5 },
  { name: "Paraguay", code: "PY", tier: 5 },
  { name: "Czechia", code: "CZ", tier: 5 },
  { name: "Bosnia and Herzegovina", code: "BA", tier: 5 },
  { name: "Uzbekistan", code: "UZ", tier: 5 },
  { name: "DR Congo", code: "CD", tier: 5 },

  // Tier 6 — longshots
  { name: "Jordan", code: "JO", tier: 6 },
  { name: "Iraq", code: "IQ", tier: 6 },
  { name: "South Africa", code: "ZA", tier: 6 },
  { name: "Ghana", code: "GH", tier: 6 },
  { name: "Cape Verde", code: "CV", tier: 6 },
  { name: "Curaçao", code: "CW", tier: 6 },
  { name: "Haiti", code: "HT", tier: 6 },
  { name: "New Zealand", code: "NZ", tier: 6 },
];

export const TIER_LABELS: Record<number, string> = {
  1: "Tier 1 · Strongest",
  2: "Tier 2 · Strong",
  3: "Tier 3 · Middle",
  4: "Tier 4 · Lower",
  5: "Tier 5 · Underdogs",
  6: "Tier 6 · Longshots",
};
