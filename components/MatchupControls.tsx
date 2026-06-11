"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { MatchDay, RoundFilter } from "@/lib/matchups";
import type { Player } from "@/lib/types";

const DAY_TABS: { key: MatchDay; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "previous", label: "Previous" },
  { key: "upcoming", label: "Upcoming" },
];

const ROUND_FILTERS: { key: RoundFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "group", label: "Group Stage" },
  { key: "knockout", label: "Knockout" },
];

/**
 * Tabs + filters for the Matchups page. Pushes its state into the URL query
 * (?tab=&round=&player=) so the server component can read it and render the
 * right slice — no client-side data fetching needed.
 */
export function MatchupControls({
  tab,
  round,
  playerId,
  players,
  counts,
}: {
  tab: MatchDay;
  round: RoundFilter;
  playerId: string;
  players: Player[];
  counts: Record<MatchDay, number>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-3">
      <nav className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        {DAY_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setParam("tab", t.key === "today" ? "" : t.key)}
            className={`flex-1 rounded-lg px-3 py-2 text-center transition ${
              tab === t.key
                ? "bg-white text-pitch-700 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
            <span className="ml-1 text-xs font-normal text-slate-400">
              {counts[t.key]}
            </span>
          </button>
        ))}
      </nav>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1.5">
          {ROUND_FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setParam("round", f.key === "all" ? "" : f.key)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                round === f.key
                  ? "bg-pitch-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <label className="ml-auto flex items-center gap-2 text-xs font-semibold text-slate-600">
          My teams
          <select
            value={playerId}
            onChange={(e) => setParam("player", e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-pitch-500 focus:ring-2 focus:ring-pitch-200"
          >
            <option value="">Everyone</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}
