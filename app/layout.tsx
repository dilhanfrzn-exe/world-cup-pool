import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import { getCurrentUser } from "@/lib/supabase/auth-server";
import { isSuperAdmin } from "@/lib/auth";
import { HeaderMenu } from "@/components/HeaderMenu";

export const metadata: Metadata = {
  title: "World Cup Pool",
  description:
    "Create a World Cup team draw with friends — invite by link, run a fair draw, trade teams, and track points and the prize pot.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0a7a3d",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  const superAdmin = isSuperAdmin(user?.email);

  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/80 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2 font-extrabold"
            >
              <span className="text-xl">⚽️</span>
              <span className="whitespace-nowrap text-slate-900">
                World Cup Pool
              </span>
            </Link>
            <div className="flex items-center gap-2">
              {user ? (
                <HeaderMenu email={user.email ?? null} isSuperAdmin={superAdmin} />
              ) : (
                <Link
                  href="/login"
                  className="rounded-xl border border-slate-300 px-2.5 py-1.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Log in
                </Link>
              )}
              <Link
                href="/create"
                className="rounded-xl bg-pitch-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-pitch-700"
              >
                Create pool
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-3xl px-4 py-8 text-center text-xs text-slate-400">
          World Cup Pool · No real payments — track buy-ins manually.
        </footer>
      </body>
    </html>
  );
}
