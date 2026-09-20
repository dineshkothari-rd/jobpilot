import { createClient } from "@/lib/supabase/server";
import { interviewId, parseInterview } from "@/lib/applications/interviews";

const columns = "id,application_id,round,starts_at,timezone,duration_minutes,location,notes,status,outcome,version";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const unavailable = () => json({ error: "We couldn’t check your interview plan. Your draft hasn’t been discarded; retry shortly." }, 503);

export async function GET(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to see your interviews." }, 401);
    const application = new URL(request.url).searchParams.get("application");
    if (application && !interviewId(application)) return json({ error: "Choose a valid application." }, 400);
    let query = client.from("application_interviews").select(columns).eq("user_id", user.id);
    if (application) query = query.eq("application_id", application);
    else query = query.eq("status", "scheduled");
    // ponytail: 200 upcoming interviews; paginate if real account usage exceeds this ceiling.
    const result = await query.order("starts_at", { ascending: true }).limit(200);
    return result.error ? unavailable() : json({ interviews: result.data || [], storageReady: true });
  } catch { return unavailable(); }
}

export async function POST(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to save your interview." }, 401);
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Request origin is not allowed." }, 403);
    let event;
    try {
      const reader = request.body?.getReader();
      if (!reader) throw new Error("Interview details are required.");
      const decoder = new TextDecoder(); let text = "", bytes = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 32768) { await reader.cancel(); return json({ error: "Interview request is too large." }, 413); }
        text += decoder.decode(value, { stream: true });
      }
      event = parseInterview(JSON.parse(text + decoder.decode()));
    } catch (e) { return json({ error: e instanceof Error ? e.message : "Check your interview details." }, 400); }
    const application = await client.from("applications").select("id").eq("id", event.application_id).eq("user_id", user.id).maybeSingle();
    if (application.error) return unavailable();
    if (!application.data) return json({ error: "This application isn’t available in your account." }, 404);
    const previousVersion = event.version;
    const value = { ...event, version: previousVersion + 1 };
    const result = previousVersion === 0
      ? await client.from("application_interviews").insert({ ...value, user_id: user.id }).select(columns).single()
      : await client.from("application_interviews").update(value).eq("id", event.id).eq("application_id", event.application_id).eq("user_id", user.id).eq("version", previousVersion).select(columns).maybeSingle();
    if (result.error?.code === "23505" || (!result.error && !result.data)) return json({ error: "This interview changed in another tab. Reload saved rounds before editing; nothing was overwritten." }, 409);
    return result.error ? unavailable() : json({ interview: result.data });
  } catch { return unavailable(); }
}
