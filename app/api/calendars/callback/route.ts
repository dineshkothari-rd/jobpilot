import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { calendarAdmin } from "@/lib/calendars/server";
import { calendarConfig, calendarScope, calendarTokens, readCalendarOAuth, seal } from "@/lib/calendars/provider";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const response = NextResponse.redirect(new URL("/profile?calendar=failed",url.origin));
  response.headers.set("Cache-Control","private, no-store");response.headers.set("Referrer-Policy","no-referrer");
  response.cookies.set("jobpilot-calendar-state","",{httpOnly:true,secure:true,sameSite:"lax",path:"/api/calendars/callback",maxAge:0});
  try {
    const client = await createClient();const { data: { user }, error } = await client.auth.getUser();
    if (error || !user || url.searchParams.has("error")) return response;
    const code = url.searchParams.get("code");const state = url.searchParams.get("state");const cookie = (await cookies()).get("jobpilot-calendar-state")?.value;
    if (!code || code.length>4096 || !state || state.length>200 || !cookie || cookie.length>2048) return response;
    const flow = readCalendarOAuth(cookie,state,user.id);const config = calendarConfig(flow.provider);
    if (!config.ready || url.origin !== config.origin) return response;
    const token = await calendarTokens(flow.provider,{grant_type:"authorization_code",code,redirect_uri:config.redirectUri,code_verifier:flow.verifier});
    if (!token.refresh_token || token.scope && !token.scope.split(" ").some(scope => flow.provider === "google" ? scope === calendarScope.google : /(^|\/)Calendars.ReadWrite$/i.test(scope))) return response;
    const id = randomUUID();const purpose = `${user.id}:${id}`;
    const { error: saveError } = await calendarAdmin().rpc("store_calendar_connection",{p_id:id,p_user:user.id,p_provider:flow.provider,p_access:seal(token.access_token,`${purpose}:access`),p_refresh:seal(token.refresh_token,`${purpose}:refresh`),p_expires:new Date(Date.now()+token.expires_in*1000).toISOString()});
    if (saveError) return response;
    response.headers.set("Location",new URL("/profile?calendar=connected",config.origin).href);
  } catch { /* Never log OAuth codes, tokens, or provider response bodies. */ }
  return response;
}
