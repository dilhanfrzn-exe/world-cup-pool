"use client";

import { useState } from "react";
import Link from "next/link";
import { signOutAction } from "@/lib/auth-actions";

export function HeaderMenu({
  email,
  isSuperAdmin,
}: {
  email: string | null;
  isSuperAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop: inline links */}
      <div className="hidden items-center gap-2 sm:flex">
        {isSuperAdmin && (
          <Link
            href="/dashboard"
            className="rounded-xl px-2.5 py-1.5 text-sm font-semibold text-amber-700 hover:bg-amber-50"
          >
            Dashboard
          </Link>
        )}
        <Link
          href="/rooms"
          className="rounded-xl px-2.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          My pools
        </Link>
        {email && (
          <span
            className="max-w-[10rem] truncate text-sm text-slate-500"
            title={email}
          >
            {email}
          </span>
        )}
        <form action={signOutAction}>
          <button
            type="submit"
            className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Log out
          </button>
        </form>
      </div>

      {/* Mobile: hamburger dropdown */}
      <div className="relative sm:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-label="Menu"
          aria-expanded={open}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 text-slate-700 transition hover:bg-slate-50"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            {open ? (
              <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </>
            ) : (
              <>
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </>
            )}
          </svg>
        </button>

        {open && (
          <>
            <button
              type="button"
              aria-hidden
              tabIndex={-1}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-10 cursor-default"
            />
            <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              {email && (
                <p
                  className="truncate px-3 py-2 text-xs text-slate-400"
                  title={email}
                >
                  {email}
                </p>
              )}
              {isSuperAdmin && (
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-3 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
                >
                  Dashboard
                </Link>
              )}
              <Link
                href="/rooms"
                onClick={() => setOpen(false)}
                className="block rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                My pools
              </Link>
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="block w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Log out
                </button>
              </form>
            </div>
          </>
        )}
      </div>
    </>
  );
}
