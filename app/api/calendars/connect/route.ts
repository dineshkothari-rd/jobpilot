import { createClient } from "@/lib/supabase/server";
import { beginCalendarOAuth, calendarProvider } from "@/lib/calendars/provider";
import { NextResponse } from "next/server";
export async function POST(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return Response.json({ error: "This request must come from Parth Careers." }, { status: 403 });
  try {
    const client = await createClient(); const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return Response.json({ error: "Sign in to connect a calendar." }, { status: 401 });
    // Provider comes from a bounded query parameter, never a client-supplied OAuth endpoint.
    const provider = new URL(request.url).searchParams.get("provider");
    if (!calendarProvider(provider)) return Response.json({ error: "Choose Google or Outlook." }, { status: 400 });
    const [existing, deletion] = await Promise.all([client.from("calendar_connections").select("id").eq("user_id",user.id).eq("provider",provider).maybeSingle(),client.from("account_deletion_requests").select("user_id").eq("user_id",user.id).maybeSingle()]);
    if (existing.error || deletion.error) return Response.json({ error: "Calendar storage is not available yet." }, { status: 503 });
    if (existing.data || deletion.data) return Response.json({ error: "Disconnect the existing calendar first, or finish pending account deletion." }, { status: 409 });
    const flow = beginCalendarOAuth(provider,user.id);
    const response = NextResponse.json({ url: flow.url }, { headers: { "Cache-Control": "private, no-store" } });
    response.cookies.set("jobpilot-calendar-state",flow.cookie,{httpOnly:true,secure:true,sameSite:"lax",path:"/api/calendars/callback",maxAge:600});
    return response;
  } catch { return Response.json({ error: "Calendar connection setup is pending. Try again later." }, { status: 503 }); }
}
