import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { CreatePoolForm } from "@/components/forms";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Create a pool · World Cup Pool" };

export default async function CreatePage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="space-y-6">
        <SupabaseNotice />
      </div>
    );
  }

  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/create");

  return (
    <div className="space-y-6">
      <div>
        <Link href="/" className="text-sm font-medium text-pitch-700">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-900">
          Create a new pool
        </h1>
        <p className="text-sm text-slate-500">
          Set it up once, then share the room link with your friends.
        </p>
      </div>

      <Card>
        <CreatePoolForm />
      </Card>

      <p className="text-center text-xs text-slate-400">
        You&apos;ll be the host with admin controls. Friends log in and join with
        their name.
      </p>
    </div>
  );
}
