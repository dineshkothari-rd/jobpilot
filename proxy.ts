import { createServerClient } from "@supabase/ssr";
import { safeInternalPath } from "@/lib/site-url";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // Route handlers return their own predictable JSON authentication errors.
  if (pathname.startsWith("/api/")) return response;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  const isAuthCallback = pathname === "/auth/callback";
  const isPublicPage = pathname === "/" || pathname === "/auth/login" || isAuthCallback || /^\/verify\/learning\/[0-9a-f-]{36}$/i.test(pathname);

  if (!user && !isPublicPage) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/auth/login";
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/auth/login") {
    const nextPath = safeInternalPath(request.nextUrl.searchParams.get("next"));
    const dashboardUrl = request.nextUrl.clone();
    const target = nextPath && !nextPath.startsWith("/auth/") ? new URL(nextPath, request.nextUrl.origin) : new URL("/dashboard", request.nextUrl.origin);
    dashboardUrl.pathname = target.pathname;
    dashboardUrl.search = target.search;
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
