/**
 * Seed data: 48 nations for the 2026 World Cup, split into 6 tiers of 8.
 * 48 teams across 6 even tiers means tiered draws work for pools of
 * 2, 4, or 8 players out of the box (each divides 8 evenly).
 *
 * `code` is an ISO-3166 alpha-2 code used to render a flag emoji. A couple of
 * UK nations reuse "GB" purely for the flag glyph.
 */

export interface SeedTeam {
  name: string;
  code: string;
  tier: number;
}

/** Convert an ISO alpha-2 country code into its flag emoji. */
export function flagEmoji(code: string | null | undefined): string {
  if (!code || code.length !== 2) return "\u{1F3F3}\u{FE0F}"; // white flag fallback
  const base = 127397; // regional indicator offset
  return code
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(base + c.charCodeAt(0)));
}

export const WORLD_CUP_TEAMS: SeedTeam[] = [
  // Tier 1 — strongest
  { name: "Argentina", code: "AR", tier: 1 },
  { name: "France", code: "FR", tier: 1 },
  { name: "Brazil", code: "BR", tier: 1 },
  { name: "Spain", code: "ES", tier: 1 },
  { name: "England", code: "GB", tier: 1 },
  { name: "Portugal", code: "PT", tier: 1 },
  { name: "Netherlands", code: "NL", tier: 1 },
  { name: "Germany", code: "DE", tier: 1 },

  // Tier 2 — strong
  { name: "Belgium", code: "BE", tier: 2 },
  { name: "Croatia", code: "HR", tier: 2 },
  { name: "Uruguay", code: "UY", tier: 2 },
  { name: "Italy", code: "IT", tier: 2 },
  { name: "Colombia", code: "CO", tier: 2 },
  { name: "Morocco", code: "MA", tier: 2 },
  { name: "United States", code: "US", tier: 2 },
  { name: "Mexico", code: "MX", tier: 2 },

  // Tier 3 — middle
  { name: "Switzerland", code: "CH", tier: 3 },
  { name: "Denmark", code: "DK", tier: 3 },
  { name: "Japan", code: "JP", tier: 3 },
  { name: "Senegal", code: "SN", tier: 3 },
  { name: "Serbia", code: "RS", tier: 3 },
  { name: "Poland", code: "PL", tier: 3 },
  { name: "South Korea", code: "KR", tier: 3 },
  { name: "Ecuador", code: "EC", tier: 3 },

  // Tier 4 — lower
  { name: "Australia", code: "AU", tier: 4 },
  { name: "Canada", code: "CA", tier: 4 },
  { name: "Sweden", code: "SE", tier: 4 },
  { name: "Nigeria", code: "NG", tier: 4 },
  { name: "Ukraine", code: "UA", tier: 4 },
  { name: "Wales", code: "GB", tier: 4 },
  { name: "Ghana", code: "GH", tier: 4 },
  { name: "Cameroon", code: "CM", tier: 4 },

  // Tier 5 — underdogs
  { name: "Saudi Arabia", code: "SA", tier: 5 },
  { name: "Qatar", code: "QA", tier: 5 },
  { name: "Egypt", code: "EG", tier: 5 },
  { name: "Tunisia", code: "TN", tier: 5 },
  { name: "Costa Rica", code: "CR", tier: 5 },
  { name: "Peru", code: "PE", tier: 5 },
  { name: "Algeria", code: "DZ", tier: 5 },
  { name: "Ivory Coast", code: "CI", tier: 5 },

  // Tier 6 — longshots
  { name: "New Zealand", code: "NZ", tier: 6 },
  { name: "Panama", code: "PA", tier: 6 },
  { name: "Jamaica", code: "JM", tier: 6 },
  { name: "Honduras", code: "HN", tier: 6 },
  { name: "Iraq", code: "IQ", tier: 6 },
  { name: "Jordan", code: "JO", tier: 6 },
  { name: "Uzbekistan", code: "UZ", tier: 6 },
  { name: "South Africa", code: "ZA", tier: 6 },
];

export const TIER_LABELS: Record<number, string> = {
  1: "Tier 1 · Strongest",
  2: "Tier 2 · Strong",
  3: "Tier 3 · Middle",
  4: "Tier 4 · Lower",
  5: "Tier 5 · Underdogs",
  6: "Tier 6 · Longshots",
};
