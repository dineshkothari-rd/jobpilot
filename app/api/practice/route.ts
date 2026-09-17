import { createClient } from "@/lib/supabase/server";
import { learningAdmin } from "@/lib/learning/server";
import { getResumeSkills, type ParsedResumeSkills } from "@/lib/matching/scorer";
import { buildQuestions, parseProgress, parseSetup, reviewSummary, sessionFields, validId, type PracticeSession } from "@/lib/practice/model";

export const runtime = "nodejs";
const headers = { "Cache-Control": "private, no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const unavailable = () => json({ error: "Practice storage is unavailable. Keep your draft and retry; an administrator may need to apply the interview practice migration and configure the existing server-only key." }, 503);

export async function GET(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to practice privately." }, 401);
    const id = new URL(request.url).searchParams.get("id");
    if (id) {
      if (!validId(id)) return json({ error: "Invalid session ID." }, 400);
      const result = await client.from("interview_practice_sessions").select(sessionFields).eq("user_id", user.id).eq("id", id).maybeSingle();
      if (result.error) return unavailable();
      return result.data ? json({ session: result.data }) : json({ error: "Session not found." }, 404);
    }
    const [sessions, profile, resume, applications] = await Promise.all([
      client.from("interview_practice_sessions").select("id,role,topic,mode,minutes,status,version,created_at,updated_at").eq("user_id", user.id).order("updated_at", { ascending: false }).limit(100),
      client.from("profiles").select("target_role").eq("id", user.id).maybeSingle(),
      client.from("resumes").select("parsed_data").eq("user_id", user.id).eq("is_primary", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      client.from("applications").select("job_id").eq("user_id", user.id).order("created_at", { ascending: false }).limit(30),
    ]);
    if (profile.error || resume.error || applications.error) return json({ error: "Could not load practice context. Retry." }, 503);
    const ids = Array.from(new Set((applications.data || []).map(a => a.job_id).filter(Boolean)));
    const jobs = ids.length ? await client.from("jobs").select("id,title,company_name").in("id", ids) : { data: [], error: null };
    if (jobs.error) return json({ error: "Could not load your target jobs. Retry." }, 503);
    return json({ userId: user.id, targetRole: profile.data?.target_role || "", skills: getResumeSkills(resume.data?.parsed_data as ParsedResumeSkills | null), jobs: jobs.data || [], sessions: sessions.data || [], storageReady: !sessions.error && Boolean(process.env.SUPABASE_SECRET_KEY) });
  } catch { return unavailable(); }
}

export async function POST(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to practice privately." }, 401);
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return json({ error: "Cross-origin writes are not allowed." }, 403);
    // Bound streamed bytes, not only a caller-controlled Content-Length header.
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "A JSON body is required." }, 400);
    const chunks: Uint8Array[] = []; let bytes = 0;
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 700000) { await reader.cancel(); return json({ error: "Practice request is too large." }, 413); }
      chunks.push(value);
    }
    const content = new Uint8Array(bytes); let offset = 0;
    for (const chunk of chunks) { content.set(chunk, offset); offset += chunk.length; }
    let body: Record<string, unknown>;
    try {
      const parsed: unknown = JSON.parse(new TextDecoder().decode(content));
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
      body = parsed as Record<string, unknown>;
    } catch { return json({ error: "A valid JSON body is required." }, 400); }
    if (!validId(body.id)) return json({ error: "A valid session ID is required." }, 400);
    const admin = learningAdmin();
    const current = await admin.from("interview_practice_sessions").select(sessionFields).eq("user_id", user.id).eq("id", body.id).maybeSingle();
    if (current.error) return unavailable();
    if (body.action === "create") {
      if (current.data) return json({ session: current.data }); // Idempotent retry after a lost response.
      const count = await admin.from("interview_practice_sessions").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if (count.error) return unavailable();
      // ponytail: bounded per-account storage, not an atomic abuse limiter; add a DB rate gate if parallel abuse appears.
      if ((count.count || 0) >= 100) return json({ error: "You have 100 saved sessions. Delete an old session before starting another." }, 429);
      let setup;
      try { setup = parseSetup(body); } catch (e) { return json({ error: e instanceof Error ? e.message : "Invalid setup." }, 400); }
      let role = setup.role; let skills: string[] = []; let jobContext = "";
      if (setup.jobId) {
        const job = await client.from("jobs").select("title,skills,description").eq("id", setup.jobId).maybeSingle();
        if (job.error || !job.data) return json({ error: "Target job is unavailable." }, 404);
        role = (job.data.title || role).slice(0, 120);
        skills = Array.isArray(job.data.skills) ? job.data.skills.filter((s): s is string => typeof s === "string") : [];
        jobContext = (job.data.description || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0,900);
      } else {
        const resume = await client.from("resumes").select("parsed_data").eq("user_id", user.id).eq("is_primary", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
        if (resume.error) return unavailable();
        skills = getResumeSkills(resume.data?.parsed_data as ParsedResumeSkills | null);
      }
      let questions = buildQuestions(setup.topic, role, setup.mode, setup.minutes, skills);
      if (setup.jobId && jobContext && setup.mode !== "behavioral") {
        questions = [{ id: "job-scenario", category: "role-specific", difficulty: "Medium", focusArea: "Job description", learningPath: "", jobContext,
          question: `Which requirement in this ${role} description would you tackle first, and how would you prove your approach works?`,
          whatToCover: ["Quote an actual requirement", "Explain an approach and trade-off", "Give an honest example or describe a learning gap"],
          evaluationCriteria: ["Used an actual requirement from the supplied description", "Explained a practical approach and checks", "Distinguished real experience from a proposed approach"] }, ...questions.slice(0,-1)];
      }
      if (body.retryId != null) {
        if (!validId(body.retryId)) return json({ error: "Invalid retry session." }, 400);
        const previous = await admin.from("interview_practice_sessions").select(sessionFields).eq("user_id", user.id).eq("id", body.retryId).maybeSingle();
        if (previous.error) return unavailable();
        if (!previous.data) return json({ error: "Retry session not found." }, 404);
        const old = previous.data as PracticeSession;
        questions = reviewSummary(old).weak;
        if (!questions.length) return json({ error: "This session has no self-reported weak questions to retry." }, 400);
        setup.topic = old.topic; setup.mode = old.mode; role = old.role; setup.jobId = old.job_id;
      }
      const result = await admin.from("interview_practice_sessions").insert({ id: body.id, user_id: user.id, job_id: setup.jobId || null, role, topic: setup.topic, mode: setup.mode, minutes: setup.minutes, questions }).select(sessionFields).single();
      if (result.error?.code === "23505") return json({ error: "Creation is already in progress. Retry with the same session ID." }, 409);
      return result.error ? unavailable() : json({ session: result.data });
    }
    if (!current.data) return json({ error: "Session not found." }, 404);
    if (body.action === "delete") {
      const result = await admin.from("interview_practice_sessions").delete().eq("user_id", user.id).eq("id", body.id);
      return result.error ? unavailable() : json({ deleted: true });
    }
    if (body.action !== "save") return json({ error: "Unsupported practice action." }, 400);
    if (!Number.isSafeInteger(body.version) || Number(body.version) < 1) return json({ error: "Refresh the session version before saving." }, 400);
    let progress;
    try { progress = parseProgress(body, current.data as PracticeSession); } catch (e) { return json({ error: e instanceof Error ? e.message : "Invalid progress." }, 400); }
    const result = await admin.from("interview_practice_sessions").update({ ...progress, version: Number(body.version) + 1, updated_at: new Date().toISOString() }).eq("user_id", user.id).eq("id", body.id).eq("version", body.version).select(sessionFields).maybeSingle();
    if (result.error) return unavailable();
    return result.data ? json({ session: result.data }) : json({ error: "This session changed in another tab. Your draft is preserved; copy it before loading the latest saved version." }, 409);
  } catch { return unavailable(); }
}
