import "server-only";

/**
 * Minimal server-side API-Football client.
 *
 * API-Football (https://www.api-football.com/) authenticates with a single
 * header, `x-apisports-key`. That key is read from a SERVER-ONLY env var, so
 * this module imports `server-only` to guarantee it can never be bundled into
 * client code.
 *
 * Everything World-Cup-specific (league/season) lives in the small helpers at
 * the bottom; the core `apiFootballGet` just does an authenticated GET.
 */

const DEFAULT_BASE_URL = "https://v3.football.api-sports.io";

export const WORLD_CUP_LEAGUE_ID = Number(
  process.env.API_FOOTBALL_LEAGUE_ID ?? 1,
);
export const WORLD_CUP_SEASON = Number(process.env.API_FOOTBALL_SEASON ?? 2026);

/** Live-match status codes per API-Football (in-play periods). */
export const LIVE_STATUS_FILTER = "1H-HT-2H-ET-P-BT-LIVE";

/** Thrown for any API-Football failure so callers can log a clear message. */
export class ApiFootballError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiFootballError";
  }
}

export function isApiFootballConfigured(): boolean {
  return Boolean(process.env.API_FOOTBALL_KEY);
}

function baseUrl(): string {
  return process.env.API_FOOTBALL_BASE_URL?.replace(/\/$/, "") ?? DEFAULT_BASE_URL;
}

type QueryValue = string | number | boolean | undefined | null;

/** Shape of every API-Football response envelope. */
export interface ApiFootballResponse<T> {
  get: string;
  parameters: Record<string, string>;
  errors: unknown;
  results: number;
  paging: { current: number; total: number };
  response: T[];
}

/**
 * Authenticated GET against API-Football. Throws `ApiFootballError` on a
 * missing key, a non-2xx response, a rate-limit, or an API-level error payload.
 * Server-side only.
 */
export async function apiFootballGet<T>(
  path: string,
  params: Record<string, QueryValue> = {},
): Promise<ApiFootballResponse<T>> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) {
    throw new ApiFootballError(
      "API_FOOTBALL_KEY is not set. Add it to your environment to enable syncing.",
    );
  }

  const url = new URL(`${baseUrl()}/${path.replace(/^\//, "")}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, String(v));
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "x-apisports-key": key },
      // Always fetch fresh data; this only runs in server actions / cron.
      cache: "no-store",
    });
  } catch (e) {
    throw new ApiFootballError(
      `Network error calling API-Football: ${(e as Error).message}`,
    );
  }

  if (res.status === 429) {
    throw new ApiFootballError(
      "API-Football rate limit reached. Try again in a little while.",
      429,
    );
  }
  if (!res.ok) {
    throw new ApiFootballError(
      `API-Football request failed (${res.status} ${res.statusText}).`,
      res.status,
    );
  }

  const json = (await res.json()) as ApiFootballResponse<T>;

  // API-Football returns 200 with a non-empty `errors` object/array on
  // auth/quota problems, so surface those as errors too.
  const errors = json.errors;
  const hasErrors = Array.isArray(errors)
    ? errors.length > 0
    : errors && typeof errors === "object" && Object.keys(errors).length > 0;
  if (hasErrors) {
    throw new ApiFootballError(
      `API-Football returned errors: ${JSON.stringify(errors)}`,
      res.status,
    );
  }

  return json;
}

// ---------------------------------------------------------------------------
// World-Cup-specific endpoint helpers (typed in ./types).
// ---------------------------------------------------------------------------
import type { ApiTeamEntry, ApiFixture } from "./types";

const wcParams = {
  league: WORLD_CUP_LEAGUE_ID,
  season: WORLD_CUP_SEASON,
};

/** GET /teams?league=&season= — the World Cup field. */
export function fetchWorldCupTeams() {
  return apiFootballGet<ApiTeamEntry>("teams", wcParams);
}

/** GET /fixtures?league=&season= — every World Cup match. */
export function fetchWorldCupFixtures() {
  return apiFootballGet<ApiFixture>("fixtures", wcParams);
}

/** GET /fixtures/rounds?league=&season= — round names in play. */
export function fetchWorldCupRounds() {
  return apiFootballGet<string>("fixtures/rounds", wcParams);
}

/** GET /standings?league=&season= — group standings (kept for future use). */
export function fetchWorldCupStandings() {
  return apiFootballGet<unknown>("standings", wcParams);
}

/**
 * GET /fixtures?league=&season=&status=... — currently live World Cup matches.
 * Structured for live match cards; not used to drive standings in the MVP.
 */
export function fetchLiveWorldCupFixtures() {
  return apiFootballGet<ApiFixture>("fixtures", {
    ...wcParams,
    status: LIVE_STATUS_FILTER,
  });
}

/**
 * GET /fixtures?id=ID-ID-... — up to 20 fixtures by id. Useful for cheap
 * targeted refreshes (e.g. only today's matches) on a schedule.
 */
export function fetchFixturesByIds(ids: number[]) {
  if (ids.length === 0 || ids.length > 20) {
    throw new ApiFootballError("Pass between 1 and 20 fixture ids.");
  }
  return apiFootballGet<ApiFixture>("fixtures", { id: ids.join("-") });
}
