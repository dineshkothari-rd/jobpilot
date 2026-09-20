import { createHash } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { jobId, parseManualJob } from "@/lib/jobs/manual";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
async function body(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Opportunity details are required.");
  const decoder = new TextDecoder(); let value = "", bytes = 0;
  while (true) { const part = await reader.read(); if (part.done) break; bytes += part.value.byteLength; if (bytes > 32768) { await reader.cancel(); throw new RangeError(); } value += decoder.decode(part.value, { stream: true }); }
  return JSON.parse(value + decoder.decode());
}
async function session(request: Request) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { response: json({ error: "Sign in to manage your opportunities." }, 401) };
  const origin = request.headers.get("origin");
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return { response: json({ error: "Request origin is not allowed." }, 403) };
  return { client, user };
}

export async function POST(request: Request) {
  try {
    const auth = await session(request); if ("response" in auth) return auth.response;
    let input; try { input = parseManualJob(await body(request)); } catch (error) { return json({ error: error instanceof RangeError ? "Opportunity request is too large." : error instanceof Error ? error.message : "Check the opportunity details." }, error instanceof RangeError ? 413 : 400); }
    const { requestId, ...job } = input;
    const externalId = `user:${auth.user.id}:${createHash("sha256").update(requestId).digest("hex")}`;
    const result = await auth.client.from("jobs").insert({ ...job, external_id: externalId, source_url: job.application_url, source: "user", created_by: auth.user.id, published_at: new Date().toISOString(), raw_data: {}, version: 1 }).select("id").single();
    if (result.error?.code === "23505") {
      const existing = await auth.client.from("jobs").select("id,external_id").eq("created_by", auth.user.id).eq("application_url", job.application_url).maybeSingle();
      if (existing.data?.external_id === externalId) return json({ id: existing.data.id, requestId, retried: true });
      return json({ error: "You already added this job link. Open the existing opportunity instead.", code: "DUPLICATE", id: existing.data?.id || null }, 409);
    }
    return result.error ? json({ error: "We couldn’t add this opportunity. Your form is still available; retry." }, 503) : json({ id: result.data.id, requestId }, 201);
  } catch { return json({ error: "We couldn’t add this opportunity. Retry shortly." }, 503); }
}

export async function PATCH(request: Request) {
  try {
    const auth = await session(request); if ("response" in auth) return auth.response;
    let input: Record<string, unknown>; try { const value = await body(request); if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).some(key => !["id", "closed", "version"].includes(key))) throw new Error(); input = value; } catch (error) { return json({ error: error instanceof RangeError ? "Opportunity request is too large." : "Invalid opportunity update." }, error instanceof RangeError ? 413 : 400); }
    if (!jobId(input.id) || typeof input.closed !== "boolean" || !Number.isSafeInteger(input.version) || Number(input.version) < 1) return json({ error: "Invalid opportunity update." }, 400);
    const value = { expires_at: input.closed ? new Date().toISOString() : null, version: Number(input.version) + 1, updated_at: new Date().toISOString() };
    const result = await auth.client.from("jobs").update(value).eq("id", input.id).eq("created_by", auth.user.id).eq("source", "user").eq("version", input.version).select("id,version,expires_at").maybeSingle();
    if (!result.error && !result.data) return json({ error: "This opportunity changed in another tab. Refresh before retrying." }, 409);
    return result.error ? json({ error: "We couldn’t update this opportunity. Retry." }, 503) : json({ job: result.data });
  } catch { return json({ error: "We couldn’t update this opportunity. Retry." }, 503); }
}
