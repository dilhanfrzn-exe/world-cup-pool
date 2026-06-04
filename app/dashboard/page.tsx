import Link from "next/link";
import { Card, Badge, EmptyState, LinkButton, Stat } from "@/components/ui";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { getAllPoolSummaries } from "@/lib/data";
import { computePayouts, drawTypeLabel, formatMoney } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · World Cup Pool" };

const STATUS_TONE: Record<string, "slate" | "green" | "amber" | "blue"> = {
  open: "amber",
  drawn: "blue",
  active: "green",
  complete: "slate",
};

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) return <SupabaseNotice />;

  const user = await getCurrentUser();
  if (!isSuperAdmin(user?.email)) {
    return (
      <Card>
        <h1 className="text-xl font-extrabold text-slate-900">Super-admin only</h1>
        <p className="mt-2 text-sm text-slate-500">
          This dashboard oversees every pool and is restricted to accounts in the{" "}
          <code className="font-mono">SUPERADMIN_EMAILS</code> allowlist.
        </p>
        {!user && (
          <div className="mt-4">
            <LinkButton href="/login?next=/dashboard">Log in</LinkButton>
          </div>
        )}
      </Card>
    );
  }

  const pools = await getAllPoolSummaries();
  const totalPlayers = pools.reduce((s, p) => s + p.player_count, 0);
  const totalPot = pools.reduce(
    (s, p) => s + computePayouts(p.buy_in, p.player_count, p.payout_structure).pot,
    0,
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          🛰️ Super-admin dashboard
        </h1>
        <p className="text-sm text-slate-500">
          Every pool across World Cup Pool. You have host powers in all rooms.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Pools" value={pools.length} />
        <Stat label="Players" value={totalPlayers} />
        <Stat label="Total pot" value={formatMoney(totalPot)} />
      </div>

      <Card>
        {pools.length === 0 ? (
          <EmptyState>No pools have been created yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {pools.map((pool) => (
              <li
                key={pool.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/room/${pool.room_code}`}
                      className="truncate font-bold text-slate-900 hover:text-pitch-700"
                    >
                      {pool.name}
                    </Link>
                    <Badge tone={STATUS_TONE[pool.status] ?? "slate"}>
                      {pool.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    <span className="font-mono tracking-widest">
                      {pool.room_code}
                    </span>{" "}
                    · {drawTypeLabel(pool.draw_type)} ·{" "}
                    {pool.player_count} players ({pool.paid_count} paid) ·{" "}
                    pot{" "}
                    {formatMoney(
                      computePayouts(
                        pool.buy_in,
                        pool.player_count,
                        pool.payout_structure,
                      ).pot,
                    )}
                  </p>
                </div>
                <div className="shrink-0">
                  <LinkButton href={`/room/${pool.room_code}`} variant="secondary">
                    Open
                  </LinkButton>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
