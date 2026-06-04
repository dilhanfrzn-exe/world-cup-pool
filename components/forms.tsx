"use client";

import { useFormState } from "react-dom";
import { SubmitButton } from "./SubmitButton";
import {
  addPlayerAction,
  addTeamAction,
  createPoolAction,
  joinPoolAction,
  runDrawAction,
  seedTeamsAction,
  updateResultAction,
} from "@/lib/actions";
import { KNOCKOUT_STAGES } from "@/lib/scoring";
import type { ActionState, KnockoutStage, Team, TeamResult } from "@/lib/types";

const initial: ActionState = {};

export const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-pitch-500 focus:ring-2 focus:ring-pitch-200";
export const labelClass =
  "mb-1 block text-sm font-medium text-slate-700";

function FormMessage({ state }: { state: ActionState }) {
  if (state.error)
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
        {state.error}
      </p>
    );
  if (state.success)
    return (
      <p className="rounded-lg bg-pitch-50 px-3 py-2 text-sm font-medium text-pitch-800">
        {state.success}
      </p>
    );
  return null;
}

// ---------------------------------------------------------------------------
export function CreatePoolForm() {
  const [state, action] = useFormState(createPoolAction, initial);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className={labelClass}>Pool name</label>
        <input
          name="name"
          required
          placeholder="2026 World Cup Pool"
          className={inputClass}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Buy-in ($)</label>
          <input
            name="buy_in"
            type="number"
            min={0}
            step="1"
            defaultValue={20}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Number of players</label>
          <input
            name="num_players"
            type="number"
            min={0}
            step="1"
            defaultValue={8}
            className={inputClass}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={labelClass}>Draw type</label>
          <select name="draw_type" defaultValue="random" className={inputClass}>
            <option value="random">Random</option>
            <option value="tiered">Tiered (by pot)</option>
            <option value="auction">Auction (coming soon)</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Payout</label>
          <select
            name="payout_structure"
            defaultValue="top_3"
            className={inputClass}
          >
            <option value="winner_take_all">Winner takes all</option>
            <option value="top_3">Top 3 payout</option>
          </select>
        </div>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Creating pool…" className="w-full">
        Create pool
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function JoinForm({ roomCode }: { roomCode: string }) {
  const [state, action] = useFormState(joinPoolAction, initial);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="room_code" value={roomCode} />
      <div>
        <label className={labelClass}>Your name</label>
        <input name="name" required placeholder="Dilhan" className={inputClass} />
      </div>
      <div>
        <label className={labelClass}>Nickname (optional)</label>
        <input name="nickname" placeholder="The Gaffer" className={inputClass} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Joining…" className="w-full">
        Join this pool
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
function AdminHidden({ poolId, code }: { poolId: string; code: string }) {
  return (
    <>
      <input type="hidden" name="pool_id" value={poolId} />
      <input type="hidden" name="room_code" value={code} />
    </>
  );
}

export function AddPlayerForm(props: { poolId: string; code: string }) {
  const [state, action] = useFormState(addPlayerAction, initial);
  return (
    <form action={action} className="space-y-3">
      <AdminHidden {...props} />
      <div className="grid grid-cols-2 gap-3">
        <input name="name" required placeholder="Player name" className={inputClass} />
        <input name="nickname" placeholder="Nickname (optional)" className={inputClass} />
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Adding…">Add player</SubmitButton>
    </form>
  );
}

export function AddTeamForm(props: { poolId: string; code: string }) {
  const [state, action] = useFormState(addTeamAction, initial);
  return (
    <form action={action} className="space-y-3">
      <AdminHidden {...props} />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <input
          name="name"
          required
          placeholder="Team name"
          className={`${inputClass} col-span-2`}
        />
        <input
          name="country_code"
          maxLength={2}
          placeholder="ISO (AR)"
          className={inputClass}
        />
        <select name="tier" defaultValue="1" className={inputClass}>
          {[1, 2, 3, 4, 5, 6].map((t) => (
            <option key={t} value={t}>
              Tier {t}
            </option>
          ))}
        </select>
      </div>
      <FormMessage state={state} />
      <SubmitButton pendingText="Adding…">Add team</SubmitButton>
    </form>
  );
}

export function SeedTeamsForm(props: { poolId: string; code: string }) {
  const [state, action] = useFormState(seedTeamsAction, initial);
  return (
    <form action={action} className="space-y-2">
      <AdminHidden {...props} />
      <FormMessage state={state} />
      <SubmitButton variant="secondary" pendingText="Loading teams…">
        Load 48 World Cup teams
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function RunDrawForm(props: {
  poolId: string;
  code: string;
  drawTypeLabel: string;
}) {
  const [state, action] = useFormState(runDrawAction, initial);
  return (
    <form action={action} className="space-y-3">
      <AdminHidden poolId={props.poolId} code={props.code} />
      <FormMessage state={state} />
      <SubmitButton pendingText="Drawing teams…" className="w-full">
        Run {props.drawTypeLabel} draw
      </SubmitButton>
    </form>
  );
}

// ---------------------------------------------------------------------------
export function UpdateResultForm({
  team,
  result,
  poolId,
  code,
}: {
  team: Team;
  result: TeamResult | undefined;
  poolId: string;
  code: string;
}) {
  const [state, action] = useFormState(updateResultAction, initial);
  return (
    <form action={action} className="space-y-3">
      <AdminHidden poolId={poolId} code={code} />
      <input type="hidden" name="team_id" value={team.id} />
      <div className="grid grid-cols-3 gap-2">
        <label className="text-xs font-medium text-slate-600">
          Wins
          <input
            name="group_wins"
            type="number"
            min={0}
            defaultValue={result?.group_wins ?? 0}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Draws
          <input
            name="group_draws"
            type="number"
            min={0}
            defaultValue={result?.group_draws ?? 0}
            className={`${inputClass} mt-1`}
          />
        </label>
        <label className="text-xs font-medium text-slate-600">
          Losses
          <input
            name="group_losses"
            type="number"
            min={0}
            defaultValue={result?.group_losses ?? 0}
            className={`${inputClass} mt-1`}
          />
        </label>
      </div>
      <label className="block text-xs font-medium text-slate-600">
        Knockout stage reached
        <select
          name="knockout_stage"
          defaultValue={(result?.knockout_stage as KnockoutStage) ?? "none"}
          className={`${inputClass} mt-1`}
        >
          {KNOCKOUT_STAGES.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <FormMessage state={state} />
        </div>
        <SubmitButton pendingText="Saving…" variant="secondary">
          Save
        </SubmitButton>
      </div>
    </form>
  );
}
