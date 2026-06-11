/**
 * Pure helpers for matching API-Football national teams to the local seed
 * teams by name. National-team names differ between sources ("Türkiye" vs
 * "Turkey", "South Korea" vs "Korea Republic", ...), so we normalize and keep a
 * small alias table. No I/O here — easy to unit-test.
 */

/** Lowercase, strip diacritics and punctuation for forgiving comparisons. */
export function normalizeName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // drop combining marks
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Known alternative names the API may use, keyed by our seed team name. The
 * values are extra strings to also recognize for that team.
 */
const ALIASES: Record<string, string[]> = {
  "United States": ["USA", "United States of America"],
  "South Korea": ["Korea Republic", "Korea South"],
  Iran: ["IR Iran", "Iran Islamic Republic"],
  "Türkiye": ["Turkey", "Turkiye"],
  "Ivory Coast": ["Cote d'Ivoire", "Côte d'Ivoire"],
  Czechia: ["Czech Republic"],
  "DR Congo": [
    "Congo DR",
    "Democratic Republic of the Congo",
    "Congo Democratic Republic",
  ],
  "Bosnia and Herzegovina": ["Bosnia & Herzegovina", "Bosnia"],
  "Cape Verde": ["Cabo Verde", "Cape Verde Islands", "Cabo Verde Islands"],
  "Curaçao": ["Curacao"],
};

/**
 * Build a lookup from a normalized name (canonical or alias) to the canonical
 * seed-team name, given the list of local team names in the pool.
 */
export function buildNameLookup(localNames: string[]): Map<string, string> {
  const lookup = new Map<string, string>();
  for (const name of localNames) {
    lookup.set(normalizeName(name), name);
    for (const alias of ALIASES[name] ?? []) {
      lookup.set(normalizeName(alias), name);
    }
  }
  return lookup;
}

/** Resolve an API team name to a local seed-team name, or null if no match. */
export function matchApiTeamName(
  apiName: string,
  lookup: Map<string, string>,
): string | null {
  return lookup.get(normalizeName(apiName)) ?? null;
}
