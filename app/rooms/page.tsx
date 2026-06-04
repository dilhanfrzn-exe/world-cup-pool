import { redirect } from "next/navigation";
import { Card, SectionTitle, EmptyState, LinkButton } from "@/components/ui";
import { PoolList } from "@/components/PoolList";
import { JoinByCode } from "@/components/JoinByCode";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getPoolsForUser } from "@/lib/data";

export const dynamic = "force-dynamic";
export const metadata = { title: "My pools · World Cup Pool" };

export default async function RoomsPage() {
  if (!isSupabaseConfigured()) return <SupabaseNotice />;

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/rooms");

  const pools = await getPoolsForUser(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Your pools</h1>
        <p className="text-sm text-slate-500">
          Every pool you host or have joined.
        </p>
      </div>

      {pools.length === 0 ? (
        <Card className="space-y-4">
          <EmptyState>
            You&apos;re not in any pools yet. Create one or join with a room code.
          </EmptyState>
          <LinkButton href="/create">Create a pool</LinkButton>
          <div className="border-t border-slate-100 pt-4">
            <SectionTitle title="Join a pool" subtitle="Got a room code?" />
            <JoinByCode />
          </div>
        </Card>
      ) : (
        <PoolList pools={pools} />
      )}
    </div>
  );
}
