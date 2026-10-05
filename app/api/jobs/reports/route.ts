import { createClient } from "@/lib/supabase/server";
import { isModerator, parseJobReport } from "@/lib/jobs/reports";
import { jobId } from "@/lib/jobs/manual";

const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });

async function session(request: Request, admin = false) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { response: json({ error: "Sign in to report jobs." }, 401) };
  if (admin && !isModerator(user)) return { response: json({ error: "Admin access required." }, 403) };
  if (request.method !== "GET" && ((request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site")) return { response: json({ error: "Request origin is not allowed." }, 403) };
  return { client, user };
}

async function body(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Report details are required.");
  const decoder = new TextDecoder(); let text = "", bytes = 0;
  while (true) {
    const part = await reader.read(); if (part.done) break;
    bytes += part.value.byteLength;
    if (bytes > 12000) { await reader.cancel(); throw new RangeError("Report is too large."); }
    text += decoder.decode(part.value, { stream: true });
  }
  return JSON.parse(text + decoder.decode());
}

export async function POST(request: Request) {
  try {
    const auth = await session(request); if ("response" in auth) return auth.response;
    let report; try { report = parseJobReport(await body(request)); } catch (error) { return json({ error: error instanceof RangeError ? error.message : "Choose a category and describe the concern in 10–2000 characters." }, error instanceof RangeError ? 413 : 400); }
    const { error } = await auth.client.from("job_reports").insert({ ...report, user_id: auth.user.id });
    if (error?.code === "23505") return json({ success: true, alreadyReported: true });
    if (error?.code === "P0001") return json({ error: "Daily report limit reached. Try again tomorrow." }, 429);
    if (error?.code === "42501" || error?.code === "23503") return json({ error: "This job is unavailable." }, 404);
    return error ? json({ error: "Reporting is unavailable. Keep your details and retry shortly." }, 503) : json({ success: true }, 201);
  } catch { return json({ error: "Reporting is unavailable. Retry shortly." }, 503); }
}

export async function GET(request: Request) {
  try {
    const auth = await session(request, true); if ("response" in auth) return auth.response;
    const { data, error } = await auth.client.from("job_reports")
      .select("id,job_id,category,details,status,created_at,jobs(title,company_name)")
      .eq("status", "pending").order("created_at").limit(100);
    return error ? json({ error: "Moderation queue is unavailable." }, 503) : json({ reports: data || [] });
  } catch { return json({ error: "Moderation queue is unavailable." }, 503); }
}

export async function PATCH(request: Request) {
  try {
    const auth = await session(request, true); if ("response" in auth) return auth.response;
    let value; try { value = await body(request); } catch (error) { return json({ error: "Invalid moderation request." }, error instanceof RangeError ? 413 : 400); }
    if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["id", "status", "note"].includes(key)) || !jobId(value.id)
      || !["confirmed", "dismissed"].includes(value.status) || typeof value.note !== "string" || !value.note.trim() || value.note.length > 2000) return json({ error: "Choose a decision and provide a review note." }, 400);
    // The database trigger hides a confirmed job in the same transaction.
    const { data, error } = await auth.client.from("job_reports")
      .update({ status: value.status, review_note: value.note.trim(), reviewed_by: auth.user.id, reviewed_at: new Date().toISOString() })
      .eq("id", value.id).eq("status", "pending").select("id").maybeSingle();
    if (error) return json({ error: "Unable to save the decision. Retry shortly." }, 503);
    return data ? json({ success: true }) : json({ error: "This report was already reviewed. Refresh the queue." }, 409);
  } catch { return json({ error: "Unable to save the decision. Retry shortly." }, 503); }
}
