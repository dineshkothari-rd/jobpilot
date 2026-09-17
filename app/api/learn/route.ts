import { createClient } from "@/lib/supabase/server";
import { learningAdmin } from "@/lib/learning/server";
import { findLearningPath, recommendPaths } from "@/lib/learning/catalog";
import { assessmentQuestions, gradeAssessment } from "@/lib/learning/assessment";
import { boundedText, certificateEligible, credentialIdValid, initialEnrollment, parseExternalCredential, parseProgress, record, type Enrollment } from "@/lib/learning/model";
import { getResumeSkills } from "@/lib/matching/scorer";

const enrollmentFields = "path_id,version,completed,bookmarks,notes,selected_lesson,minutes_per_day,target_role,project_url,project_summary,updated_at";
const credentialFields = "id,kind,path_id,title,issuer,issued_on,expires_on,verification_url,credential_ref,public_name,is_public,revoked_at";
const noStore = { "Cache-Control": "no-store" };
const missingSchema = (error: { code?: string } | null) => error && ["42P01", "PGRST205"].includes(error.code || "");
const setupMessage = "Learning storage setup is pending. An administrator must apply the SkillPath migration and configure the existing server-only key. Free resources still work.";
function failure(error: { code?: string } | null) {
  return Response.json({ error: missingSchema(error) ? setupMessage : "Could not save learning data. Your edits are still available; retry." }, { status: missingSchema(error) ? 503 : 500, headers: noStore });
}

export async function GET(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return Response.json({ error: "You must be logged in." }, { status: 401, headers: noStore });
    const pathId = new URL(request.url).searchParams.get("path");
    if (pathId && !findLearningPath(pathId)) return Response.json({ error: "Learning path not found." }, { status: 404 });
    const [enrollments, credentials, attempts, profile, resume, jobs] = await Promise.all([
      client.from("skillpath_enrollments").select(enrollmentFields).eq("user_id", user.id).order("updated_at", { ascending: false }).limit(20),
      client.from("skillpath_credentials").select(credentialFields).eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      client.from("skillpath_attempts").select("id,path_id,score,created_at").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100),
      client.from("profiles").select("target_role").eq("id", user.id).maybeSingle(),
      client.from("resumes").select("parsed_data").eq("user_id", user.id).eq("is_primary", true).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      client.from("jobs").select("title,skills").order("published_at", { ascending: false, nullsFirst: false }).limit(80),
    ]);
    const storageError = enrollments.error || credentials.error || attempts.error;
    if (storageError && !missingSchema(storageError)) return failure(storageError);
    const personalizationAvailable = !profile.error && !resume.error && !jobs.error;
    const targetRole = profile.data?.target_role || "";
    const recommendations = recommendPaths(getResumeSkills(resume.data?.parsed_data || null), targetRole,
      (jobs.data || []).map((job) => ({ title: job.title || "", skills: Array.isArray(job.skills) ? job.skills.filter((skill: unknown): skill is string => typeof skill === "string") : [] })));
    return Response.json({ enrollments: enrollments.data || [], credentials: credentials.data || [], attempts: attempts.data || [],
      storageReady: !storageError && Boolean(process.env.SUPABASE_SECRET_KEY), setupMessage,
      targetRole, personalizationAvailable, recommendations,
      questions: pathId ? assessmentQuestions(pathId) : [],
    }, { headers: noStore });
  } catch {
    return Response.json({ error: "Could not load learning. Retry without losing your edits." }, { status: 500, headers: noStore });
  }
}

export async function POST(request: Request) {
  try {
    const client = await createClient();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return Response.json({ error: "You must be logged in." }, { status: 401, headers: noStore });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin) return Response.json({ error: "Request origin is not allowed." }, { status: 403 });
    let body: Record<string, unknown>;
    try {
      const text = await request.text();
      if (text.length > 20000) return Response.json({ error: "Learning request is too large." }, { status: 413 });
      body = record(JSON.parse(text));
    } catch { return Response.json({ error: "Invalid learning request." }, { status: 400 }); }
    if (!process.env.SUPABASE_SECRET_KEY) return Response.json({ error: setupMessage }, { status: 503 });
    const admin = learningAdmin();
    const ok = (data: Record<string, unknown>) => Response.json(data, { headers: noStore });
    const invalid = (message: string) => Response.json({ error: message }, { status: 400, headers: noStore });

    if (body.action === "credential") {
      let value;
      try { value = parseExternalCredential(body.credential); } catch (error) { return invalid(error instanceof Error ? error.message : "Invalid credential."); }
      if (!credentialIdValid(body.requestId)) return invalid("A valid request ID is required.");
      const previous = await admin.from("skillpath_credentials").select(credentialFields).eq("id", body.requestId).eq("user_id", user.id).eq("kind", "external").maybeSingle();
      if (previous.error) return failure(previous.error);
      if (previous.data) return ok({ credential: previous.data });
      const { count, error: countError } = await admin.from("skillpath_credentials").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if (countError) return failure(countError);
      if ((count || 0) >= 100) return invalid("Keep at most 100 credentials; remove an old entry before adding another.");
      const { data, error } = await admin.from("skillpath_credentials").insert({ ...value, id: body.requestId, user_id: user.id, kind: "external" }).select(credentialFields).single();
      if (error?.code === "23505") {
        const existing = await admin.from("skillpath_credentials").select(credentialFields).eq("id", body.requestId).eq("user_id", user.id).eq("kind", "external").maybeSingle();
        if (existing.error) return failure(existing.error);
        if (existing.data) return ok({ credential: existing.data });
      }
      return error ? failure(error) : ok({ credential: data });
    }

    if (["share", "revoke", "deleteCredential"].includes(String(body.action))) {
      if (!credentialIdValid(body.id)) return invalid("Choose a valid credential.");
      let query;
      if (body.action === "deleteCredential") query = admin.from("skillpath_credentials").delete().eq("kind", "external");
      else if (body.action === "revoke") query = admin.from("skillpath_credentials").update({ revoked_at: new Date().toISOString(), is_public: false }).eq("kind", "jobpilot");
      else {
        if (typeof body.enabled !== "boolean") return invalid("Choose whether to share this completion record.");
        let name;
        try { name = boundedText(body.publicName, 120, "Public display name", body.enabled); } catch { return invalid("Choose a public display name of at most 120 characters."); }
        query = admin.from("skillpath_credentials").update({ is_public: body.enabled, public_name: body.enabled ? name : "" }).eq("kind", "jobpilot").is("revoked_at", null);
      }
      const { data, error } = await query.eq("id", body.id).eq("user_id", user.id).select(credentialFields).maybeSingle();
      if (error) return failure(error);
      return data ? ok({ credential: data }) : Response.json({ error: "Credential is unavailable or not yours." }, { status: 404 });
    }

    const path = typeof body.pathId === "string" ? findLearningPath(body.pathId) : undefined;
    if (!path) return invalid("Choose a supported learning path.");
    if (body.action === "enroll") {
      const fresh = initialEnrollment(path);
      const { data, error } = await admin.from("skillpath_enrollments").insert({ ...fresh, user_id: user.id }).select(enrollmentFields).single();
      if (error?.code === "23505") {
        const existing = await admin.from("skillpath_enrollments").select(enrollmentFields).eq("user_id", user.id).eq("path_id", path.id).single();
        return existing.error ? failure(existing.error) : ok({ enrollment: existing.data });
      }
      return error ? failure(error) : ok({ enrollment: data });
    }

    if (body.action === "save") {
      let progress;
      try {
        if (!Number.isSafeInteger(body.version) || Number(body.version) < 1) throw new Error("Refresh this path before saving.");
        progress = parseProgress(body.progress, path);
      } catch (error) { return invalid(error instanceof Error ? error.message : "Invalid progress."); }
      const { data, error } = await admin.from("skillpath_enrollments").update({ ...progress, version: Number(body.version) + 1, updated_at: new Date().toISOString() })
        .eq("user_id", user.id).eq("path_id", path.id).eq("version", body.version).select(enrollmentFields).maybeSingle();
      if (error) return failure(error);
      return data ? ok({ enrollment: data }) : Response.json({ error: "Progress changed in another tab. Copy your edits before refreshing; they have not been overwritten." }, { status: 409, headers: noStore });
    }

    const enrollmentResult = await admin.from("skillpath_enrollments").select(enrollmentFields).eq("user_id", user.id).eq("path_id", path.id).maybeSingle();
    if (enrollmentResult.error) return failure(enrollmentResult.error);
    if (!enrollmentResult.data) return invalid("Start this path before taking an assessment or requesting completion.");
    if (body.action === "assess") {
      let grade;
      try { grade = gradeAssessment(path.id, body.answers); } catch (error) { return invalid(error instanceof Error ? error.message : "Invalid answers."); }
      if (!credentialIdValid(body.requestId)) return invalid("A valid assessment request ID is required.");
      const existing = await admin.from("skillpath_attempts").select("id,path_id,score,created_at,answers").eq("id", body.requestId).eq("user_id", user.id).eq("path_id", path.id).maybeSingle();
      if (existing.error) return failure(existing.error);
      if (existing.data) return ok({ ...gradeAssessment(path.id, existing.data.answers), attempt: { id: existing.data.id, path_id: path.id, score: existing.data.score, created_at: existing.data.created_at } });
      const since = new Date(Date.now() - 86400000).toISOString();
      const count = await admin.from("skillpath_attempts").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("path_id", path.id).gte("created_at", since);
      if (count.error) return failure(count.error);
      if ((count.count || 0) >= 20) return Response.json({ error: "You have reached 20 attempts for this path in 24 hours. Review the lessons and try later." }, { status: 429 });
      // ponytail: bounded history, not an atomic abuse limiter; add a DB-backed rate gate if parallel abuse appears.
      const { data, error } = await admin.from("skillpath_attempts").insert({ id: body.requestId, user_id: user.id, path_id: path.id, score: grade.score, answers: body.answers }).select("id,path_id,score,created_at").single();
      if (error?.code === "23505") return Response.json({ error: "This attempt is already being saved. Retry the same attempt." }, { status: 409 });
      return error ? failure(error) : ok({ ...grade, attempt: data });
    }

    if (body.action === "issue") {
      if (body.confirmed !== true) return invalid("Confirm you completed the exercises and that this is your own project.");
      const attempt = await admin.from("skillpath_attempts").select("score").eq("user_id", user.id).eq("path_id", path.id).order("score", { ascending: false }).limit(1).maybeSingle();
      if (attempt.error) return failure(attempt.error);
      if (!certificateEligible(path, enrollmentResult.data as Enrollment, attempt.data?.score || 0)) return invalid("Complete all lessons, pass the knowledge check (2 of 3) and save a project URL with an explanation of at least 50 characters first.");
      const { data, error } = await admin.from("skillpath_credentials").insert({ user_id: user.id, kind: "jobpilot", path_id: path.id, title: path.title, issuer: "JobPilot", issued_on: new Date().toISOString().slice(0, 10) }).select(credentialFields).single();
      if (error?.code === "23505") {
        const existing = await admin.from("skillpath_credentials").select(credentialFields).eq("user_id", user.id).eq("path_id", path.id).eq("kind", "jobpilot").maybeSingle();
        return existing.error ? failure(existing.error) : ok({ credential: existing.data });
      }
      return error ? failure(error) : ok({ credential: data });
    }
    return invalid("Unsupported learning action.");
  } catch {
    return Response.json({ error: "Learning save failed safely. Keep your edits and retry." }, { status: 500, headers: noStore });
  }
}
