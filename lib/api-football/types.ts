/**
 * Types for the slices of API-Football responses we actually use, plus the
 * internal "normalized round" model the rest of the app reasons about.
 *
 * These are intentionally partial — API-Football returns much more per object,
 * but pinning only what we read keeps the sync code honest and easy to test.
 */

// --- /teams?league=&season= ------------------------------------------------
export interface ApiTeam {
  id: number;
  name: string;
  /** 3-letter code, e.g. "FRA" (not always present). */
  code: string | null;
  country: string | null;
  logo: string | null;
}

export interface ApiTeamEntry {
  team: ApiTeam;
}

// --- /fixtures?league=&season= ---------------------------------------------
export interface ApiFixtureTeam {
  id: number;
  name: string;
  logo: string | null;
  /** true = won, false = lost, null = draw or not finished. */
  winner: boolean | null;
}

export interface ApiFixtureVenue {
  id: number | null;
  name: string | null;
  city: string | null;
}

export interface ApiFixture {
  fixture: {
    id: number;
    date: string | null;
    venue: ApiFixtureVenue | null;
    status: {
      long: string | null;
      short: string | null;
      elapsed: number | null;
    };
  };
  league: {
    id: number;
    season: number;
    round: string | null;
  };
  teams: {
    home: ApiFixtureTeam;
    away: ApiFixtureTeam;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
}

/**
 * Internal, normalized round identifiers. The API's free-text round strings
 * ("Round of 16", "8th Finals", "Final - 1", ...) are mapped onto these so the
 * recalculation logic isn't fragile to formatting changes.
 */
export type InternalRound =
  | "group"
  | "r32"
  | "r16"
  | "qf"
  | "sf"
  | "third_place"
  | "final"
  | "unknown";
