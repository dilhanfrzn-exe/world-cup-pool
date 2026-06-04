export function SupabaseNotice() {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
      <p className="font-bold">⚙️ Supabase isn&apos;t connected yet</p>
      <p className="mt-1">
        Add your Supabase keys to <code className="font-mono">.env.local</code>{" "}
        and run the SQL in{" "}
        <code className="font-mono">supabase/migrations/0001_init.sql</code>{" "}
        before creating a pool. See the README for the 3-minute setup.
      </p>
    </div>
  );
}
