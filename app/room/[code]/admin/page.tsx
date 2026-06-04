import { notFound } from "next/navigation";
import { Card, SectionTitle, Badge, EmptyState, LinkButton } from "@/components/ui";
import { RoomNav } from "@/components/RoomNav";
import { SubmitButton } from "@/components/SubmitButton";
import { UpdateResultForm } from "@/components/forms";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { setPaidAction } from "@/lib/actions";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser, isPoolAdmin } from "@/lib/auth";
import { getFullRoom } from "@/lib/data";
import { countIncomingTrades } from "@/lib/trades";
import type { TeamResult } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  params,
}: {
  params: { code: string };
}) {
  if (!isSupabaseConfigured()) return <SupabaseNotice />;

  const code = params.code.toUpperCase();
  const [room, user] = await Promise.all([getFullRoom(code), getCurrentUser()]);
  if (!room) notFound();

  const { pool, players, teams, results, assignments } = room;
  const isAdmin = isPoolAdmin(pool, user);
  const tradeCount = countIncomingTrades(room.trades, players, user?.id);

  if (!isAdmin) {
    return (
      <div className="space-y-6">
        <RoomNav
          code={code}
          active="room"
          showTrade={assignments.length > 0}
          tradeCount={tradeCount}
        />
        <Card>
          <h1 className="text-xl font-extrabold text-slate-900">Host only</h1>
          <p className="mt-2 text-sm text-slate-500">
            Only the pool host (and super-admins) can manage results and payments.
          </p>
          {!user && (
            <div className="mt-4">
              <LinkButton href={`/login?next=/room/${code}/admin`}>
                Log in
              </LinkButton>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const resultByTeam = new Map<string, TeamResult>();
  for (const r of results) resultByTeam.set(r.team_id, r);

  return (
    <div className="space-y-6">
      <RoomNav
        code={code}
        isAdmin
        showTrade={assignments.length > 0}
        tradeCount={tradeCount}
        active="admin"
      />

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">🛠️ Host admin</h1>
        <p className="text-sm text-slate-500">
          Update team results and track who&apos;s paid. Standings recalculate
          automatically.
        </p>
      </div>

      {/* Payments ----------------------------------------------------- */}
      <Card>
        <SectionTitle title="Payments" subtitle="Mark players paid or unpaid (manual)." />
        {players.length === 0 ? (
          <EmptyState>No players yet.</EmptyState>
        ) : (
          <ul className="divide-y divide-slate-100">
            {players.map((p) => (
              <li key={p.id} className="flex items-center justify-between py-2.5">
                <span className="font-semibold text-slate-900">{p.name}</span>
                <div className="flex items-center gap-2">
                  <Badge tone={p.paid ? "green" : "amber"}>
                    {p.paid ? "Paid" : "Unpaid"}
                  </Badge>
                  <form action={setPaidAction}>
                    <input type="hidden" name="pool_id" value={pool.id} />
                    <input type="hidden" name="room_code" value={code} />
                    <input type="hidden" name="player_id" value={p.id} />
                    <input type="hidden" name="paid" value={p.paid ? "false" : "true"} />
                    <SubmitButton variant="secondary">
                      Mark {p.paid ? "unpaid" : "paid"}
                    </SubmitButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Results ------------------------------------------------------ */}
      <Card>
        <SectionTitle
          title="Team results"
          subtitle="Enter group record + furthest knockout stage per team."
        />
        {teams.length === 0 ? (
          <EmptyState>Add teams first, then enter their results here.</EmptyState>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => (
              <div key={t.id} className="rounded-xl border border-slate-100 p-3">
                <div className="mb-2 flex items-center gap-2">
                  <span className="text-lg">{t.flag ?? "🏳️"}</span>
                  <span className="font-bold text-slate-900">{t.name}</span>
                  <span className="ml-auto text-xs text-slate-400">Tier {t.tier}</span>
                </div>
                <UpdateResultForm
                  team={t}
                  result={resultByTeam.get(t.id)}
                  poolId={pool.id}
                  code={code}
                />
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
