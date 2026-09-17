import { createClient } from "@/lib/supabase/server";
import { parseDayPreferences, updateDayPreference } from "@/lib/home-next-action";

const headers = { "Cache-Control": "private, no-store" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers });
const unavailable = () => json({ error: "Your daily plan couldn’t be saved or checked. Suggestions still work; refresh to retry." }, 503);

export async function GET() {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to see your private daily plan." }, 401);
    const result = await client.from("my_day_preferences").select("preferences,version").eq("user_id", user.id).maybeSingle();
    if (result.error) return unavailable();
    return json({ preferences: parseDayPreferences(result.data?.preferences || {}), version: result.data?.version || 0, storageReady: true });
  } catch { return unavailable(); }
}

export async function POST(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to save your private daily plan." }, 401);
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "Request origin is not allowed." }, 403);
    let body: Record<string, unknown>;
    try {
      const reader = request.body?.getReader();
      if (!reader) return json({ error: "A request body is required." }, 400);
      const decoder = new TextDecoder(); let text = "", bytes = 0;
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 4096) { await reader.cancel(); return json({ error: "Daily plan request is too large." }, 413); }
        text += decoder.decode(value, { stream: true });
      }
      const value = JSON.parse(text + decoder.decode());
      if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["key", "until", "version"].includes(key))) throw new Error();
      body = value;
      if (!Number.isSafeInteger(body.version) || Number(body.version) < 0) throw new Error();
    } catch { return json({ error: "Invalid daily plan request." }, 400); }
    const current = await client.from("my_day_preferences").select("preferences,version").eq("user_id", user.id).maybeSingle();
    if (current.error) return unavailable();
    if ((current.data?.version || 0) !== body.version) return json({ error: "Your plan changed in another tab. Refresh before trying again; nothing was overwritten." }, 409);
    let preferences;
    try { preferences = updateDayPreference(current.data?.preferences || {}, body.key, body.until, Date.now()); }
    catch (e) { return json({ error: e instanceof Error ? e.message : "Invalid suggestion." }, 400); }
    const value = { preferences, version: Number(body.version) + 1, updated_at: new Date().toISOString() };
    const result = current.data
      ? await client.from("my_day_preferences").update(value).eq("user_id", user.id).eq("version", body.version).select("preferences,version").maybeSingle()
      : await client.from("my_day_preferences").insert({ ...value, user_id: user.id }).select("preferences,version").single();
    if (result.error?.code === "23505" || (!result.error && !result.data)) return json({ error: "Your plan changed in another tab. Refresh before trying again." }, 409);
    return result.error ? unavailable() : json({ ...result.data, storageReady: true });
  } catch { return unavailable(); }
}
