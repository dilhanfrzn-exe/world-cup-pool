import Link from "next/link";
import { Badge } from "./ui";
import { drawTypeLabel } from "@/lib/utils";
import type { UserPool } from "@/lib/data";

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "blue"> = {
  open: "amber",
  drawn: "blue",
  active: "green",
  complete: "slate",
};

export function PoolList({ pools }: { pools: UserPool[] }) {
  return (
    <ul className="space-y-2">
      {pools.map((pool) => (
        <li key={pool.id}>
          <Link
            href={`/room/${pool.room_code}`}
            className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-pitch-300 hover:bg-pitch-50"
          >
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate font-bold text-slate-900">
                  {pool.name}
                </span>
                <Badge tone={STATUS_TONE[pool.status] ?? "slate"}>
                  {pool.status}
                </Badge>
                <Badge tone={pool.role === "host" ? "green" : "slate"}>
                  {pool.role === "host" ? "Host" : "Player"}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                <span className="font-mono tracking-widest">
                  {pool.room_code}
                </span>{" "}
                · {drawTypeLabel(pool.draw_type)} · {pool.player_count} players
              </p>
            </div>
            <span className="shrink-0 text-sm font-semibold text-pitch-700">
              Open →
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
