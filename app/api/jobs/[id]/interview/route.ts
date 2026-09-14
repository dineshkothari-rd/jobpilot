import { createClient } from "@/lib/supabase/server";
import {
  generateInterviewSession,
} from "@/lib/ai/interview-engine";
import { getAiProviderStatus, runInterviewAiAction } from "@/lib/ai/providers/provider-factory";
import type { AiAnswerEvaluation, GroundedInterviewContext } from "@/lib/ai/providers/types";
import {
  calculateMatchScore,
  getResumeSkills,
  type MatchJob,
  type MatchPreferences,
  type MatchProfile,
  type ParsedResumeSkills,
} from "@/lib/matching/scorer";

export const runtime = "nodejs";
export const maxDuration = 15;

type RouteContext = { params: Promise<{ id: string }> };

const summary = (value: string | null | undefined) =>
  (value || "").replace(/\s+/g, " ").trim().slice(0, 1600);

async function loadContext(id: string) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return { response: Response.json({ error: "You must be logged in." }, { status: 401 }) };
  }

  if (!id.trim() || id.length > 200) {
    return { response: Response.json({ error: "A valid job ID is required." }, { status: 400 }) };
  }

  const [jobResult, profileResult, preferencesResult, resumeResult, applicationResult] = await Promise.all([
    supabase
      .from("jobs")
      .select("id,title,company_name,description,location,country,employment_type,seniority,salary_min,salary_max,skills")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("target_role,experience_years,location")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("job_preferences")
      .select("preferred_roles,preferred_locations,remote_only,employment_types,minimum_salary,preferred_countries")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("resumes")
      .select("id,file_name,parsed_data")
      .eq("user_id", user.id)
      .eq("is_primary", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("applications")
      .select("id,status")
      .eq("user_id", user.id)
      .eq("job_id", id)
      .maybeSingle(),
  ]);

  if (jobResult.error || !jobResult.data) {
    return { response: Response.json({ error: "Job not found." }, { status: 404 }) };
  }

  const contextError = profileResult.error || preferencesResult.error || resumeResult.error || applicationResult.error;
  if (contextError) throw new Error(contextError.message);

  const jobSkills = Array.isArray(jobResult.data.skills)
    ? jobResult.data.skills.filter((skill): skill is string => typeof skill === "string")
    : [];
  const candidateSkills = getResumeSkills(
    (resumeResult.data?.parsed_data as ParsedResumeSkills | null) || null,
  );
  const profile = profileResult.data;
  const preferences = preferencesResult.data;
  const session = generateInterviewSession({
    title: jobResult.data.title || "this role",
    company: jobResult.data.company_name || "the company",
    description: jobResult.data.description || "",
    seniority: jobResult.data.seniority || "",
    skills: jobSkills,
    candidateSkills,
    experienceYears: profile?.experience_years || 0,
    targetRole: profile?.target_role || preferences?.preferred_roles?.[0] || "",
  });

  const matchScore = preferences
    ? calculateMatchScore(
        { ...jobResult.data, skills: jobSkills } as MatchJob,
        {
          target_role: profile?.target_role || null,
          experience_years: profile?.experience_years ?? null,
          location: profile?.location || null,
          skills: candidateSkills,
        } satisfies MatchProfile,
        {
          preferred_roles: preferences.preferred_roles || [],
          preferred_locations: preferences.preferred_locations || [],
          remote_only: preferences.remote_only ?? false,
          employment_types: preferences.employment_types || [],
          minimum_salary: preferences.minimum_salary ?? null,
          preferred_countries: preferences.preferred_countries || [],
        } satisfies MatchPreferences,
      ).score
    : null;

  return {
    job: jobResult.data,
    session,
    matchScore,
    application: applicationResult.data || null,
    candidate: {
      targetRole: profile?.target_role || preferences?.preferred_roles?.[0] || null,
      experienceYears: profile?.experience_years ?? null,
      skills: candidateSkills,
      resumeSignals: candidateSkills.slice(0, 12),
    },
    context: {
      hasProfile: Boolean(profile),
      hasResume: Boolean(resumeResult.data),
      hasUsableResume: candidateSkills.length > 0,
      resumeName: resumeResult.data?.file_name || null,
    },
    providerStatus: {
      ai: getAiProviderStatus(),
    },
  };
}

function toInterviewEvaluation(result: AiAnswerEvaluation) {
  return {
    score: result.score,
    quality: result.rating,
    strengths: result.strengths,
    weaknesses: [
      ...result.missingPoints.map((point) => `Cover ${point}.`),
      ...result.incorrectAssumptions.map((point) => `Check assumption: ${point}.`),
    ],
    missingPoints: result.missingPoints,
    suggestedImprovement: result.betterStructure,
    idealAnswerDirection: result.suggestedAnswerDirection,
    provider: result.provider,
    followUpQuestion: result.followUpQuestion,
  };
}

export async function GET(_request: Request, route: RouteContext) {
  try {
    const { id } = await route.params;
    const result = await loadContext(id);
    if ("response" in result) return result.response;

    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("INTERVIEW GET ERROR:", error);
    return Response.json(
      { error: "Failed to generate interview." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request, route: RouteContext) {
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "A valid JSON body is required." }, { status: 400 });
    }

    const { questionId, answer } = body as { questionId?: unknown; answer?: unknown };
    if (typeof questionId !== "string" || !questionId.trim()) {
      return Response.json({ error: "Question ID is required." }, { status: 400 });
    }
    if (typeof answer !== "string" || !answer.trim()) {
      return Response.json({ error: "Answer is required." }, { status: 400 });
    }
    if (answer.length > 12000) {
      return Response.json({ error: "Answer must be 12,000 characters or fewer." }, { status: 400 });
    }

    const { id } = await route.params;
    const result = await loadContext(id);
    if ("response" in result) return result.response;
    const question = result.session.questions.find((item) => item.id === questionId);

    if (!question) {
      return Response.json({ error: "Question does not belong to this interview." }, { status: 400 });
    }

    const aiContext: GroundedInterviewContext = {
      job: {
        title: result.job.title || "",
        company: result.job.company_name || "",
        descriptionSummary: summary(result.job.description),
        seniority: result.job.seniority || null,
        skills: result.session.focusAreas,
      },
      candidate: result.candidate,
      topic: null,
      question,
      answer,
      weakAreas: result.session.focusAreas.slice(0, 5).map((area) => ({
        title: area,
        why: "Generated from interview session focus areas.",
        action: `Practice a concrete answer about ${area}.`,
      })),
    };
    const aiResult = await runInterviewAiAction("evaluate", aiContext);

    return Response.json({
      success: true,
      evaluation: toInterviewEvaluation(aiResult.result as AiAnswerEvaluation),
      providerStatus: aiResult.status,
      fallback: aiResult.fallback,
    });
  } catch (error) {
    console.error("INTERVIEW EVALUATION ERROR:", error);
    return Response.json(
      { error: "Failed to evaluate answer." },
      { status: 500 },
    );
  }
}
