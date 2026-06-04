import Link from "next/link";
import { redirect } from "next/navigation";
import { Card } from "@/components/ui";
import { AuthForm } from "@/components/AuthForm";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { isAuthConfigured, getCurrentUser } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Log in · World Cup Pool" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string };
}) {
  const next =
    searchParams.next && searchParams.next.startsWith("/")
      ? searchParams.next
      : "/";

  if (isAuthConfigured()) {
    const user = await getCurrentUser();
    if (user) redirect(next);
  }

  return (
    <div className="mx-auto max-w-sm space-y-6">
      <div className="text-center">
        <Link href="/" className="text-sm font-medium text-pitch-700">
          ← Back
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold text-slate-900">
          Log in to World Cup Pool
        </h1>
        <p className="text-sm text-slate-500">
          You need an account to create pools, join, and trade teams.
        </p>
      </div>

      {!isAuthConfigured() ? (
        <SupabaseNotice />
      ) : (
        <Card>
          <AuthForm next={next} />
        </Card>
      )}
    </div>
  );
}
