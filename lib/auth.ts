import "server-only";
import type { User } from "@supabase/supabase-js";
import type { Pool } from "./types";

export { getCurrentUser } from "./supabase/auth-server";

/** True if the email is in the SUPERADMIN_EMAILS allowlist. */
export function isSuperAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  const list = (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}

export type PoolRole = "superadmin" | "host" | "player" | "guest";

export function poolRole(pool: Pool, user: User | null): PoolRole {
  if (!user) return "guest";
  if (isSuperAdmin(user.email)) return "superadmin";
  if (pool.created_by && pool.created_by === user.id) return "host";
  return "player";
}

/** Host powers: the pool creator OR any super-admin. */
export function isPoolAdmin(pool: Pool, user: User | null): boolean {
  const role = poolRole(pool, user);
  return role === "host" || role === "superadmin";
}
