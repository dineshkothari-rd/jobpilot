import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  let destination = new URL("/dashboard", requestUrl.origin);

  if (next?.startsWith("/") && !next.startsWith("//")) {
    const candidate = new URL(next, requestUrl.origin);

    if (candidate.origin === requestUrl.origin) destination = candidate;
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);

      if (!error) return NextResponse.redirect(destination);
    } catch {
      // Fall through to the safe public error page.
    }
  }

  return NextResponse.redirect(
    new URL("/auth/login?error=oauth_callback", requestUrl.origin),
  );
}
