import { createClient } from "@/lib/supabase/server";
import { getSiteUrl, safeInternalPath } from "@/lib/site-url";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const siteUrl = getSiteUrl(requestUrl.origin);
  const code = requestUrl.searchParams.get("code");
  const authError = requestUrl.searchParams.get("error");
  const next = safeInternalPath(requestUrl.searchParams.get("next"));
  const requestedDestination = next && !next.startsWith("/auth/") ? next : "/dashboard";

  if (authError) {
    return NextResponse.redirect(new URL("/auth/login?error=oauth_cancelled", siteUrl));
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) throw userError || new Error("Missing authenticated user.");

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("id,email,full_name,avatar_url,target_role,current_company,location")
        .eq("id", user.id)
        .maybeSingle();
      if (profileError) throw profileError;

      const currentProfile = profile || await createInitialProfile(supabase, user);
      const { data: preferences, error: preferencesError } = await supabase
        .from("job_preferences")
        .select("preferred_roles")
        .eq("user_id", user.id)
        .maybeSingle();
      if (preferencesError) throw preferencesError;

      const needsProfile = !currentProfile.full_name ||
        !currentProfile.target_role ||
        !currentProfile.current_company ||
        !currentProfile.location ||
        !preferences?.preferred_roles?.length;

      return NextResponse.redirect(new URL(needsProfile ? "/profile" : requestedDestination, siteUrl));
    } catch {
      // Fall through to the safe public error page.
    }
  }

  return NextResponse.redirect(
    new URL("/auth/login?error=oauth_callback_failed", siteUrl),
  );
}

async function createInitialProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  user: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  },
) {
  const metadata = user.user_metadata || {};
  const fullName = typeof metadata.full_name === "string"
    ? metadata.full_name
    : typeof metadata.name === "string"
      ? metadata.name
      : "";
  const avatarUrl = typeof metadata.avatar_url === "string"
    ? metadata.avatar_url
    : typeof metadata.picture === "string"
      ? metadata.picture
      : null;

  const { data, error } = await supabase
    .from("profiles")
    .insert({
      id: user.id,
      email: user.email || null,
      full_name: fullName,
      avatar_url: avatarUrl,
    })
    .select("id,email,full_name,avatar_url,target_role,current_company,location")
    .single();

  if (error) throw error;
  return data;
}
