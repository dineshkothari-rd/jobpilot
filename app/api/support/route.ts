import { createClient } from "@/lib/supabase/server";
import { isModerator } from "@/lib/jobs/reports";
import { parseSupportReply, parseSupportTicket } from "@/lib/help/content";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const fields = "id,category,subject,details,status,response,version,created_at,updated_at";

export async function GET(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to contact support and view your tickets." }, 401);
    const params = new URL(request.url).searchParams;
    const queue = params.get("queue") === "1";
    const page = params.get("page") || "0";
    if (!/^\d{1,5}$/.test(page)) return json({ error: "Invalid ticket page." }, 400);
    if (queue && !isModerator(user)) return json({ error: "Admin access required." }, 403);
    const offset = Number(page) * 50;
    let query = client.from("support_tickets").select(fields).order("created_at", { ascending: false }).order("id", { ascending: false }).range(offset, offset + 50);
    if (!queue) query = query.eq("user_id", user.id);
    const { data, error: readError } = await query;
    if (readError) return json({ error: "Support tickets are temporarily unavailable. Please try again later." }, 503);
    return json({ tickets: (data || []).slice(0, 50), hasMore: (data?.length || 0) > 50, isAdmin: isModerator(user) });
  } catch { return json({ error: "Unable to load support tickets." }, 500); }
}

async function mutate(request: Request, reply: boolean) {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "This request must come from Parth Careers." }, 403);
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to contact support." }, 401);
    if (reply && !isModerator(user)) return json({ error: "Admin access required." }, 403);
    if (Number(request.headers.get("content-length") || 0) > 20000) return json({ error: "Request too large." }, 413);
    const raw = await request.text();
    if (raw.length > 20000) return json({ error: "Request too large." }, 413);
    let input;
    try { input = JSON.parse(raw); } catch { return json({ error: "Invalid request." }, 400); }
    if (reply) {
      let value;
      try { value = parseSupportReply(input); } catch (cause) { return json({ error: (cause as Error).message }, 400); }
      const { data, error: updateError } = await client.from("support_tickets").update({ status: value.status, response: value.response, version: value.version + 1 })
        .eq("id", value.id).eq("version", value.version).select(fields).maybeSingle();
      if (updateError) return json({ error: "Unable to save the reply. Refresh and try again." }, 503);
      if (!data) return json({ error: "This ticket changed or is unavailable. Refresh before replying." }, 409);
      return json({ ticket: data });
    }
    let value;
    try { value = parseSupportTicket(input); } catch (cause) { return json({ error: (cause as Error).message }, 400); }
    const { data, error: insertError } = await client.from("support_tickets").insert({ ...value, user_id: user.id }).select(fields).single();
    if (insertError?.message?.includes("support_rate_limit")) return json({ error: "You can submit up to five support tickets in 24 hours." }, 429);
    if (insertError) return json({ error: "Your ticket could not be saved. Please try again later." }, 503);
    return json({ ticket: data }, 201);
  } catch { return json({ error: "Unable to complete the support request." }, 500); }
}
export const POST = (request: Request) => mutate(request, false);
export const PATCH = (request: Request) => mutate(request, true);
