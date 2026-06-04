import { NextResponse, type NextRequest } from "next/server";
import { getAuthClient, isAuthConfigured } from "@/lib/supabase/auth-server";

export const dynamic = "force-dynamic";

function safeNext(next: string | null): string {
  // Only allow internal redirects.
  if (next && next.startsWith("/") && !next.startsWith("//")) return next;
  return "/";
}

/**
 * OAuth callback. After a provider (e.g. Google) redirects back here with a
 * `code`, exchange it for a session cookie and send the user on to `next`.
 * The PKCE verifier was stored in a cookie by the browser client when the
 * sign-in was initiated, so the exchange can complete server-side.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  const loginUrl = (msg?: string) => {
    const url = new URL("/login", origin);
    if (next !== "/") url.searchParams.set("next", next);
    if (msg) url.searchParams.set("error", msg);
    return url.toString();
  };

  if (providerError) {
    return NextResponse.redirect(loginUrl(providerError));
  }
  if (!code || !isAuthConfigured()) {
    return NextResponse.redirect(loginUrl());
  }

  const supabase = getAuthClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(loginUrl(error.message));
  }

  return NextResponse.redirect(new URL(next, origin).toString());
}
