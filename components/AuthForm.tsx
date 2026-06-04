"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { SubmitButton } from "./SubmitButton";
import { signInAction, signUpAction } from "@/lib/auth-actions";
import { inputClass, labelClass } from "./forms";
import type { ActionState } from "@/lib/types";

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

export function AuthForm({ next }: { next?: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signInState, signIn] = useFormState(signInAction, initial);
  const [signUpState, signUp] = useFormState(signUpAction, initial);

  const isSignIn = mode === "signin";
  const action = isSignIn ? signIn : signUp;
  const state = isSignIn ? signInState : signUpState;

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 text-sm font-semibold">
        <button
          type="button"
          onClick={() => setMode("signin")}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            isSignIn ? "bg-white text-pitch-700 shadow-sm" : "text-slate-500"
          }`}
        >
          Log in
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-lg px-3 py-2 transition ${
            !isSignIn ? "bg-white text-pitch-700 shadow-sm" : "text-slate-500"
          }`}
        >
          Sign up
        </button>
      </div>

      <form action={action} className="space-y-3">
        {next && <input type="hidden" name="next" value={next} />}
        <div>
          <label className={labelClass}>Email</label>
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Password</label>
          <input
            name="password"
            type="password"
            required
            autoComplete={isSignIn ? "current-password" : "new-password"}
            placeholder="••••••••"
            className={inputClass}
          />
        </div>
        <Message state={state} />
        <SubmitButton
          pendingText={isSignIn ? "Logging in…" : "Creating account…"}
          className="w-full"
        >
          {isSignIn ? "Log in" : "Create account"}
        </SubmitButton>
      </form>
    </div>
  );
}
