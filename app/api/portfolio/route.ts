import { createClient } from "@/lib/supabase/server";
import { evidenceId, parseEvidence } from "@/lib/portfolio/evidence";
import { loadCatalog } from "@/lib/learning/catalog-store";

const fields = "id,title,problem,contribution,outcome,skills,evidence_url,source_kind,source_ref,reviewed_at,version,created_at,updated_at";
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "private, no-store" } });

async function requestBody(request: Request) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Evidence details are required.");
  const decoder = new TextDecoder(); let value = "", size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > 32768) { await reader.cancel(); throw new RangeError(); }
    value += decoder.decode(part.value, { stream: true });
  }
  return JSON.parse(value + decoder.decode());
}

async function session(request?: Request) {
  const client = await createClient();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { response: json({ error: "Sign in to manage your evidence portfolio." }, 401) };
  if (request) {
    const origin = request.headers.get("origin");
    if ((origin && origin !== new URL(request.url).origin) || request.headers.get("sec-fetch-site") === "cross-site") return { response: json({ error: "Request origin is not allowed." }, 403) };
  }
  return { client, user };
}

export async function GET() {
  const auth = await session(); if ("response" in auth) return auth.response;
  // ponytail: show the latest 100; add cursor pagination when a user outgrows this private collection size.
  const result = await auth.client.from("portfolio_evidence").select(fields).order("updated_at", { ascending: false }).limit(100);
  return result.error ? json({ error: "We couldn’t load your evidence portfolio." }, 503) : json({ evidence: result.data });
}

export async function POST(request: Request) {
  try {
    const auth = await session(request); if ("response" in auth) return auth.response;
    const body = await requestBody(request);
    let evidence;
    if (body && typeof body === "object" && !Array.isArray(body) && (body as Record<string, unknown>).action === "learning") {
      const value = body as Record<string, unknown>;
      if (Object.keys(value).some(key => !["action", "pathId"].includes(key)) || typeof value.pathId !== "string") return json({ error: "Choose a valid saved learning project." }, 400);
      const entry = (await loadCatalog()).find(item => item.path.id === value.pathId);
      if (!entry) return json({ error: "Learning path not found." }, 404);
      const enrollment = await auth.client.from("skillpath_enrollments").select("project_url,project_summary").eq("user_id", auth.user.id).eq("path_id", value.pathId).maybeSingle();
      if (enrollment.error) return json({ error: "We couldn’t read your saved learning project." }, 503);
      if (!enrollment.data || enrollment.data.project_summary.trim().length < 50) return json({ error: "Save your project contribution in Learning Studio first." }, 400);
      evidence = parseEvidence({ title: `${entry.path.title} capstone`, problem: entry.path.project, contribution: enrollment.data.project_summary, outcome: "", skills: entry.path.skills, evidence_url: enrollment.data.project_url, source_kind: "learning", source_ref: entry.path.id });
    } else {
      evidence = parseEvidence(body);
      if (evidence.source_kind !== "manual") return json({ error: "Add a learning project from its saved Learning Studio path." }, 400);
    }
    const result = await auth.client.from("portfolio_evidence").insert({ ...evidence, user_id: auth.user.id }).select(fields).single();
    if (result.error?.code === "23505") return json({ error: "This learning project is already in your evidence portfolio." }, 409);
    return result.error ? json({ error: "We couldn’t save this evidence. Your draft is still here." }, 503) : json({ evidence: result.data }, 201);
  } catch (error) { return json({ error: error instanceof RangeError ? "Evidence request is too large." : error instanceof Error ? error.message : "Check the evidence details." }, error instanceof RangeError ? 413 : 400); }
}

export async function PATCH(request: Request) {
  try {
    const auth = await session(request); if ("response" in auth) return auth.response;
    const body = await requestBody(request) as Record<string, unknown>;
    if (!evidenceId(body.id) || !Number.isSafeInteger(body.version) || Number(body.version) < 1) return json({ error: "Refresh this evidence before saving." }, 400);
    let update: Record<string, unknown>;
    if (body.action === "review" && Object.keys(body).every(key => ["id", "version", "action"].includes(key))) update = { reviewed_at: new Date().toISOString() };
    else {
      const editable = ["title", "problem", "contribution", "outcome", "skills", "evidence_url"];
      if (Object.keys(body).some(key => !["id", "version", ...editable].includes(key))) throw new Error("Unsupported evidence field.");
      const value = Object.fromEntries(Object.entries(body).filter(([key]) => editable.includes(key)));
      const parsed = parseEvidence({ ...value, source_kind: "manual", source_ref: null });
      update = { title: parsed.title, problem: parsed.problem, contribution: parsed.contribution, outcome: parsed.outcome, skills: parsed.skills, evidence_url: parsed.evidence_url, reviewed_at: null };
    }
    update.version = Number(body.version) + 1; update.updated_at = new Date().toISOString();
    const result = await auth.client.from("portfolio_evidence").update(update).eq("id", body.id).eq("user_id", auth.user.id).eq("version", body.version).select(fields).maybeSingle();
    if (!result.error && !result.data) return json({ error: "This evidence changed in another tab. Reload before retrying." }, 409);
    return result.error ? json({ error: "We couldn’t update this evidence. Your draft is still here." }, 503) : json({ evidence: result.data });
  } catch (error) { return json({ error: error instanceof RangeError ? "Evidence request is too large." : error instanceof Error ? error.message : "Check the evidence details." }, error instanceof RangeError ? 413 : 400); }
}

export async function DELETE(request: Request) {
  try {
    const auth = await session(request); if ("response" in auth) return auth.response;
    const body = await requestBody(request) as Record<string, unknown>;
    if (Object.keys(body).some(key => !["id", "version"].includes(key)) || !evidenceId(body.id) || !Number.isSafeInteger(body.version) || Number(body.version) < 1) return json({ error: "Invalid evidence deletion." }, 400);
    const result = await auth.client.from("portfolio_evidence").delete().eq("id", body.id).eq("user_id", auth.user.id).eq("version", body.version).select("id").maybeSingle();
    if (!result.error && !result.data) return json({ error: "This evidence changed in another tab. Reload before retrying." }, 409);
    return result.error ? json({ error: "We couldn’t delete this evidence." }, 503) : json({ deleted: body.id });
  } catch (error) { return json({ error: error instanceof RangeError ? "Evidence request is too large." : "Invalid evidence deletion." }, error instanceof RangeError ? 413 : 400); }
}
