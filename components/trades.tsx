"use client";

import { useMemo, useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "./SubmitButton";
import { inputClass, labelClass } from "./forms";
import {
  proposeTradeAction,
  respondTradeAction,
  cancelTradeAction,
} from "@/lib/actions";
import type { ActionState, Team } from "@/lib/types";

const initial: ActionState = {};

function Message({ state }: { state: ActionState }) {
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

function TeamCheck({
  team,
  name,
  checked,
  onToggle,
}: {
  team: Team;
  name: string;
  checked: boolean;
  onToggle: (id: string, checked: boolean) => void;
}) {
  return (
    <label
      className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition ${
        checked
          ? "border-pitch-500 bg-pitch-50"
          : "border-slate-200 bg-white hover:bg-slate-50"
      }`}
    >
      <input
        type="checkbox"
        name={name}
        value={team.id}
        checked={checked}
        onChange={(e) => onToggle(team.id, e.target.checked)}
        className="accent-pitch-600"
      />
      <span>{team.flag ?? "🏳️"}</span>
      <span className="font-medium text-slate-800">{team.name}</span>
    </label>
  );
}

export interface OtherPlayer {
  id: string;
  name: string;
  teams: Team[];
}

export function ProposeTradeForm({
  roomCode,
  myTeams,
  others,
}: {
  roomCode: string;
  myTeams: Team[];
  others: OtherPlayer[];
}) {
  const [state, action] = useFormState(proposeTradeAction, initial);
  const [receiverId, setReceiverId] = useState(others[0]?.id ?? "");
  const [offered, setOffered] = useState<string[]>([]);
  const [requested, setRequested] = useState<string[]>([]);

  const receiver = useMemo(
    () => others.find((o) => o.id === receiverId) ?? null,
    [others, receiverId],
  );

  function toggle(
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    id: string,
    checked: boolean,
  ) {
    setter((prev) =>
      checked ? [...prev, id] : prev.filter((x) => x !== id),
    );
  }

  const uneven =
    offered.length + requested.length > 0 &&
    offered.length !== requested.length;

  if (others.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        There&apos;s no one else to trade with yet.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="room_code" value={roomCode} />

      <div>
        <label className={labelClass}>Trade with</label>
        <select
          name="receiver_player_id"
          value={receiverId}
          onChange={(e) => {
            setReceiverId(e.target.value);
            setRequested([]);
          }}
          className={inputClass}
        >
          {others.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">
          You give ({offered.length})
        </p>
        {myTeams.length === 0 ? (
          <p className="text-xs text-slate-400">You have no teams to give.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {myTeams.map((t) => (
              <TeamCheck
                key={t.id}
                team={t}
                name="offered_team_ids"
                checked={offered.includes(t.id)}
                onToggle={(id, c) => toggle(setOffered, id, c)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <p className="mb-1.5 text-sm font-semibold text-slate-700">
          You get ({requested.length})
        </p>
        {!receiver || receiver.teams.length === 0 ? (
          <p className="text-xs text-slate-400">
            {receiver ? `${receiver.name} has no teams.` : "Pick a player."}
          </p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {receiver.teams.map((t) => (
              <TeamCheck
                key={t.id}
                team={t}
                name="requested_team_ids"
                checked={requested.includes(t.id)}
                onToggle={(id, c) => toggle(setRequested, id, c)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <label className={labelClass}>Message (optional)</label>
        <input
          name="message"
          placeholder="Pretty please?"
          className={inputClass}
        />
      </div>

      {uneven && (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
          Heads up: this is an uneven trade ({offered.length} for{" "}
          {requested.length}). Team counts will change, so players won&apos;t all
          have the same number of teams anymore.
        </p>
      )}

      <Message state={state} />
      <SubmitButton pendingText="Sending…" className="w-full">
        Propose trade
      </SubmitButton>
    </form>
  );
}

export function RespondButtons({
  roomCode,
  tradeId,
}: {
  roomCode: string;
  tradeId: string;
}) {
  const [state, action] = useFormState(respondTradeAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="room_code" value={roomCode} />
      <input type="hidden" name="trade_id" value={tradeId} />
      <Message state={state} />
      <div className="flex gap-2">
        <button
          type="submit"
          name="decision"
          value="accept"
          className="flex-1 rounded-xl bg-pitch-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pitch-700"
        >
          Accept
        </button>
        <button
          type="submit"
          name="decision"
          value="reject"
          className="flex-1 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
        >
          Reject
        </button>
      </div>
    </form>
  );
}

export function CancelButton({
  roomCode,
  tradeId,
}: {
  roomCode: string;
  tradeId: string;
}) {
  const [state, action] = useFormState(cancelTradeAction, initial);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="room_code" value={roomCode} />
      <input type="hidden" name="trade_id" value={tradeId} />
      <Message state={state} />
      <SubmitButton variant="danger" pendingText="Cancelling…">
        Cancel trade
      </SubmitButton>
    </form>
  );
}
