"use server";

import { redirect } from "next/navigation";
import { getAuthClient, isAuthConfigured } from "./supabase/auth-server";
import type { ActionState } from "./types";

function safeNext(next: string | undefined | null): string {
  // Only allow internal redirects.
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

export async function signInAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isAuthConfigured())
    return { error: "Auth isn't configured yet. Add your Supabase keys." };

  const email = (formData.get("email")?.toString() ?? "").trim();
  const password = formData.get("password")?.toString() ?? "";
  const next = safeNext(formData.get("next")?.toString());

  if (!email || !password)
    return { error: "Enter your email and password." };

  const supabase = getAuthClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(next);
}

export async function signUpAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  if (!isAuthConfigured())
    return { error: "Auth isn't configured yet. Add your Supabase keys." };

  const email = (formData.get("email")?.toString() ?? "").trim();
  const password = formData.get("password")?.toString() ?? "";
  const next = safeNext(formData.get("next")?.toString());

  if (!email || !password)
    return { error: "Enter your email and password." };
  if (password.length < 6)
    return { error: "Password must be at least 6 characters." };

  const supabase = getAuthClient();
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  // If email confirmation is disabled in Supabase, a session is returned and
  // the user is logged in immediately. Otherwise they must confirm by email.
  if (data.session) redirect(next);
  return {
    success:
      "Account created. Check your email to confirm, then log in. " +
      "(Tip: disable email confirmation in Supabase for instant access.)",
  };
}

export async function signOutAction(): Promise<void> {
  if (isAuthConfigured()) {
    const supabase = getAuthClient();
    await supabase.auth.signOut();
  }
  redirect("/");
}
