import Link from "next/link";
import { Card, LinkButton } from "@/components/ui";
import { JoinByCode } from "@/components/JoinByCode";
import { PoolList } from "@/components/PoolList";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/auth";
import { getPoolsForUser } from "@/lib/data";

export const dynamic = "force-dynamic";

const STEPS = [
  { emoji: "🏆", title: "Create a pool", text: "Set the buy-in, players, and draw type." },
  { emoji: "🔗", title: "Invite friends", text: "Share a link — friends log in and join." },
  { emoji: "🎲", title: "Run a fair draw", text: "Everyone gets an equal split of teams." },
  { emoji: "🔁", title: "Trade & track", text: "Swap teams, then watch the standings." },
];

export default async function HomePage() {
  const user = isSupabaseConfigured() ? await getCurrentUser() : null;
  const myPools = user ? await getPoolsForUser(user.id) : [];

  return (
    <div className="space-y-8">
      {myPools.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-slate-900">Your pools</h2>
            <Link href="/rooms" className="text-sm font-semibold text-pitch-700">
              View all →
            </Link>
          </div>
          <PoolList pools={myPools} />
        </section>
      )}

      <section className="rounded-3xl bg-gradient-to-br from-pitch-700 via-pitch-600 to-pitch-800 p-8 text-white shadow-lg">
        <span className="inline-flex items-center rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
          2026 · 48 teams · trade teams with friends
        </span>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
          Run a World Cup pool with your friends.
        </h1>
        <p className="mt-3 max-w-lg text-pitch-50/90">
          Create a draw, invite the group with one link, assign teams fairly,
          and track who&apos;s winning the pot — all from your phone.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <LinkButton href="/create" variant="secondary">
            Create your pool
          </LinkButton>
          <a
            href="#join"
            className="inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/40 transition hover:bg-white/10"
          >
            I have a room code
          </a>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {STEPS.map((s) => (
          <Card key={s.title} className="flex items-start gap-3">
            <span className="text-2xl">{s.emoji}</span>
            <div>
              <h3 className="font-bold text-slate-900">{s.title}</h3>
              <p className="text-sm text-slate-500">{s.text}</p>
            </div>
          </Card>
        ))}
      </section>

      <section id="join">
        <Card>
          <h2 className="text-lg font-bold text-slate-900">Join a pool</h2>
          <p className="mb-4 text-sm text-slate-500">
            Got a room code from a friend? Enter it to jump into their pool.
          </p>
          <JoinByCode />
        </Card>
      </section>

      <p className="text-center text-sm text-slate-500">
        Hosting?{" "}
        <Link href="/create" className="font-semibold text-pitch-700">
          Create a new pool →
        </Link>
      </p>
    </div>
  );
}
