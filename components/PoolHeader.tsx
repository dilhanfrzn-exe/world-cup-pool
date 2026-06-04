import { Badge } from "./ui";
import { CopyLink } from "./CopyLink";
import { drawTypeLabel, getAppUrl, payoutStructureLabel } from "@/lib/utils";
import type { Pool } from "@/lib/types";

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "blue"> = {
  open: "amber",
  drawn: "blue",
  active: "green",
  complete: "slate",
};

export function PoolHeader({
  pool,
  isAdmin,
  isSuperAdmin = false,
}: {
  pool: Pool;
  isAdmin: boolean;
  isSuperAdmin?: boolean;
}) {
  const roomUrl = `${getAppUrl()}/room/${pool.room_code}`;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[pool.status] ?? "slate"}>{pool.status}</Badge>
        <Badge tone="slate">{drawTypeLabel(pool.draw_type)} draw</Badge>
        <Badge tone="slate">{payoutStructureLabel(pool.payout_structure)}</Badge>
        {isSuperAdmin ? (
          <Badge tone="amber">Super-admin</Badge>
        ) : (
          isAdmin && <Badge tone="green">You are the host</Badge>
        )}
      </div>
      <h1 className="text-2xl font-extrabold text-slate-900">{pool.name}</h1>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span>Room code:</span>
          <span className="font-mono text-base font-bold tracking-widest text-slate-900">
            {pool.room_code}
          </span>
        </div>
        <p className="text-xs text-slate-500">
          Share this link — friends log in and join with their name.
        </p>
        <CopyLink value={roomUrl} />
      </div>
    </div>
  );
}
