import { NextResponse } from "next/server";
import { getServerSupabase, isSupabaseConfigured } from "@/lib/supabase/server";
import { isApiFootballConfigured } from "@/lib/api-football/client";
import { syncWorldCupResults } from "@/lib/api-football/sync";
import type { Pool } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Scheduled sync endpoint, structured for Vercel Cron (NOT required for the MVP
 * — the host can always use the manual "Sync World Cup Results" button).
 *
 * To enable later, add to `vercel.json`:
 *   {
 *     "crons": [{ "path": "/api/cron/sync", "schedule": "0 * * * *" }]
 *   }
 * Vercel sends the request with `Authorization: Bearer <CRON_SECRET>`.
 *
 * Future cadence ideas (to avoid wasting API quota):
 *   - run every ~10 min on match days / while fixtures are live
 *   - run a few times a day otherwise
 *   - skip pools whose tournament is complete
 * For now it simply syncs every pool that has started.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured." },
      { status: 500 },
    );
  }

  const auth = request.headers.get("authorization");
  const url = new URL(request.url);
  const provided = auth?.replace(/^Bearer\s+/i, "") ?? url.searchParams.get("secret");
  if (provided !== secret) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSupabaseConfigured() || !isApiFootballConfigured()) {
    return NextResponse.json(
      { error: "Supabase and API-Football must both be configured." },
      { status: 500 },
    );
  }

  const supabase = getServerSupabase();
  const { data, error } = await supabase
    .from("pools")
    .select("*")
    .in("status", ["drawn", "active"]);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const pools = (data as Pool[]) ?? [];
  const results = [];
  for (const pool of pools) {
    const result = await syncWorldCupResults(pool.id, "cron");
    results.push({ poolId: pool.id, ...result });
  }

  return NextResponse.json({ synced: results.length, results });
}
