import { createClient } from "@/lib/supabase/server";
import { parsePreferences, parseSubscription, pushEndpoint, reminderConfiguration } from "@/lib/notifications/reminders";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });

export async function GET() {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to manage reminders." }, 401);
    const [prefs, devices] = await Promise.all([
      client.from("notification_preferences").select("email_enabled,push_enabled,timezone").eq("user_id", user.id).maybeSingle(),
      client.from("push_subscriptions").select("id,endpoint").eq("user_id", user.id),
    ]);
    if (prefs.error || devices.error) return json({ error: "Reminders are not available yet. Please try again later." }, 503);
    const config = reminderConfiguration();
    return json({ preferences: prefs.data, devices: devices.data || [], availability: { email: config.email && Boolean(user.email_confirmed_at), push: config.push, publicKey: config.push ? config.publicKey : "" } });
  } catch { return json({ error: "Unable to load reminders." }, 500); }
}
async function mutate(request: Request, method: "PATCH" | "POST" | "DELETE") {
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") return json({ error: "This request must come from Parth Careers." }, 403);
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to manage reminders." }, 401);
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Invalid request." }, 400);
    const chunks: Uint8Array[] = []; let length = 0;
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 8192) { await reader.cancel(); return json({ error: "Request too large." }, 413); }
      chunks.push(value);
    }
    let input;
    try { input = JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return json({ error: "Invalid request." }, 400); }
    const config = reminderConfiguration();
    if (method === "PATCH") {
      let value;
      try { value = parsePreferences(input); } catch (cause) { return json({ error: (cause as Error).message }, 400); }
      if (value.email_enabled && (!config.email || !user.email_confirmed_at) || value.push_enabled && !config.push) return json({ error: "This channel is not configured, or your email is not confirmed." }, 409);
      const { error: writeError } = await client.from("notification_preferences").upsert({ user_id: user.id, ...value }, { onConflict: "user_id" });
      if (writeError) return json({ error: "Unable to save reminder preferences." }, 503);
      return json({ preferences: value });
    }
    if (method === "DELETE") {
      let endpoint;
      try { endpoint = pushEndpoint(input?.endpoint); } catch (cause) { return json({ error: (cause as Error).message }, 400); }
      const { error: deleteError } = await client.from("push_subscriptions").delete().eq("user_id", user.id).eq("endpoint", endpoint);
      return deleteError ? json({ error: "Unable to disconnect this browser." }, 503) : json({ disconnected: true });
    }
    if (!config.push) return json({ error: "Browser push is not configured yet." }, 409);
    let value;
    try { value = parseSubscription(input); } catch (cause) { return json({ error: (cause as Error).message }, 400); }
    const { data: existing, error: readError } = await client.from("push_subscriptions").select("id,p256dh,auth").eq("user_id", user.id).eq("endpoint", value.endpoint).maybeSingle();
    if (readError) return json({ error: "Unable to connect this browser." }, 503);
    if (existing) return existing.p256dh === value.p256dh && existing.auth === value.auth ? json({ connected: true }) : json({ error: "Disconnect this browser before reconnecting it." }, 409);
    const { error: insertError } = await client.from("push_subscriptions").insert({ user_id: user.id, ...value });
    if (insertError?.code === "23505") return json({ error: "This browser belongs to another account. Disconnect it before connecting." }, 409);
    if (insertError?.message.includes("push_device_limit")) return json({ error: "You can connect up to ten browsers." }, 429);
    return insertError ? json({ error: "Unable to connect this browser." }, 503) : json({ connected: true }, 201);
  } catch { return json({ error: "Unable to update reminders." }, 500); }
}
export const PATCH = (request: Request) => mutate(request, "PATCH");
export const POST = (request: Request) => mutate(request, "POST");
export const DELETE = (request: Request) => mutate(request, "DELETE");
