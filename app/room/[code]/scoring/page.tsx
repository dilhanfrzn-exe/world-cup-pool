import { notFound } from "next/navigation";
import { Card, SectionTitle, EmptyState } from "@/components/ui";
import { RoomNav } from "@/components/RoomNav";
import { SupabaseNotice } from "@/components/SupabaseNotice";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { getCurrentUser, isPoolAdmin } from "@/lib/auth";
import { getFullRoom } from "@/lib/data";
import { countIncomingTrades } from "@/lib/trades";
import { rulesToMap } from "@/lib/scoring";

export const dynamic = "force-dynamic";

const GROUP_RULES: { key: string; icon: string; label: string }[] = [
  { key: "group_win", icon: "✅", label: "Win a group-stage match" },
  { key: "group_draw", icon: "🤝", label: "Draw a group-stage match" },
];

const KNOCKOUT_RULES: { key: string; icon: string; label: string }[] = [
  { key: "r32", icon: "🏟️", label: "Reach the Round of 32" },
  { key: "r16", icon: "🔥", label: "Reach the Round of 16" },
  { key: "qf", icon: "⚔️", label: "Reach the Quarterfinals" },
  { key: "sf", icon: "🌟", label: "Reach the Semifinals" },
  { key: "runner_up", icon: "🥈", label: "Reach the Final (Runner-up)" },
  { key: "champion", icon: "🏆", label: "Win the World Cup (Champion)" },
];

export default async function ScoringPage({
  params,
}: {
  params: { code: string };
}) {
  if (!isSupabaseConfigured()) return <SupabaseNotice />;

  const code = params.code.toUpperCase();
  const [room, user] = await Promise.all([getFullRoom(code), getCurrentUser()]);
  if (!room) notFound();

  const { pool, players, assignments, rules } = room;
  const isAdmin = isPoolAdmin(pool, user);
  const tradeCount = countIncomingTrades(room.trades, players, user?.id);
  const r = rulesToMap(rules);

  // A worked example, computed from this pool's real rules so it stays accurate.
  const exGroup = 2 * (r.group_win ?? 0) + 1 * (r.group_draw ?? 0);
  const exTotal = exGroup + (r.qf ?? 0);

  return (
    <div className="space-y-6">
      <RoomNav
        code={code}
        isAdmin={isAdmin}
        showTrade={assignments.length > 0}
        tradeCount={tradeCount}
        active="scoring"
      />

      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">
          🧮 How scoring works
        </h1>
        <p className="text-sm text-slate-500">
          Every team you own earns points as they go through the tournament. Add
          up your teams&apos; points to get your total on the Standings tab.
        </p>
      </div>

      {/* Group stage --------------------------------------------------- */}
      <Card>
        <SectionTitle
          title="1 · Group stage"
          subtitle="Points for every group match your teams play."
        />
        <ul className="space-y-2">
          {GROUP_RULES.map((rule) => (
            <PointRow
              key={rule.key}
              icon={rule.icon}
              label={rule.label}
              points={r[rule.key] ?? 0}
            />
          ))}
          <PointRow icon="❌" label="Lose a group-stage match" points={0} />
        </ul>
      </Card>

      {/* Knockout ------------------------------------------------------ */}
      <Card>
        <SectionTitle
          title="2 · Knockout bonus"
          subtitle="A bonus for the furthest round each team reaches."
        />
        <ul className="space-y-2">
          {KNOCKOUT_RULES.map((rule) => (
            <PointRow
              key={rule.key}
              icon={rule.icon}
              label={rule.label}
              points={r[rule.key] ?? 0}
            />
          ))}
        </ul>
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Heads up: the knockout bonus is for the <strong>furthest</strong> round
          a team reaches — the bonuses don&apos;t stack. A Champion earns the
          Champion bonus, not every bonus along the way.
        </p>
      </Card>

      {/* Worked example ----------------------------------------------- */}
      <Card>
        <SectionTitle
          title="Worked example"
          subtitle="Using this pool's current point values."
        />
        <div className="space-y-2 text-sm text-slate-700">
          <p>Say your team 🇦🇷 Argentina has this run:</p>
          <ul className="space-y-1.5">
            <ExampleLine
              label={`2 group wins × ${r.group_win ?? 0}`}
              value={2 * (r.group_win ?? 0)}
            />
            <ExampleLine
              label={`1 group draw × ${r.group_draw ?? 0}`}
              value={1 * (r.group_draw ?? 0)}
            />
            <ExampleLine
              label="Reaches the Quarterfinals (bonus)"
              value={r.qf ?? 0}
            />
          </ul>
          <div className="mt-2 flex items-center justify-between rounded-lg bg-pitch-50 px-3 py-2">
            <span className="font-bold text-slate-800">Team total</span>
            <span className="text-xl font-extrabold text-pitch-700">
              {exTotal} pts
            </span>
          </div>
          <p className="text-xs text-slate-400">
            ({2}×{r.group_win ?? 0} + {1}×{r.group_draw ?? 0} group ={" "}
            {exGroup}, plus the {r.qf ?? 0}-pt Quarterfinal bonus = {exTotal}.)
          </p>
        </div>
      </Card>

      {/* Your total --------------------------------------------------- */}
      <Card>
        <SectionTitle
          title="Your total"
          subtitle="How the leaderboard is built."
        />
        <p className="text-sm text-slate-700">
          Your score is simply the sum of points across <strong>all</strong> the
          teams you own. The more of your teams that win and advance, the higher
          you climb on the Standings tab.
        </p>
        {rules.length === 0 && (
          <EmptyState>
            This pool is using the default point values shown above.
          </EmptyState>
        )}
        <p className="mt-3 text-xs text-slate-400">
          {isAdmin
            ? "As host you can fine-tune results and lock individual teams from the Admin tab."
            : "Point values are set by the host and may differ from another pool."}
        </p>
      </Card>
    </div>
  );
}

function PointRow({
  icon,
  label,
  points,
}: {
  icon: string;
  label: string;
  points: number;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-2.5">
      <span className="flex items-center gap-2.5 text-sm font-medium text-slate-800">
        <span className="text-lg">{icon}</span>
        {label}
      </span>
      <span
        className={`shrink-0 rounded-full px-3 py-1 text-sm font-extrabold ${
          points > 0
            ? "bg-pitch-100 text-pitch-800"
            : "bg-slate-100 text-slate-500"
        }`}
      >
        {points > 0 ? `+${points}` : "0"} pts
      </span>
    </li>
  );
}

function ExampleLine({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-sm">
      <span className="text-slate-600">{label}</span>
      <span className="font-semibold text-slate-800">+{value}</span>
    </li>
  );
}
