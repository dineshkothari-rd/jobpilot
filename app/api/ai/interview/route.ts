import { AllowanceError, consumeAllowance } from "@/lib/plans/server";
import { generateInterviewPreparationHub, type InterviewLearningInput } from "@/lib/ai/interview-learning";
import { runInterviewAiAction } from "@/lib/ai/providers/provider-factory";
import type { AiAction, GroundedInterviewContext } from "@/lib/ai/providers/types";
import { getResumeSkills, type ParsedResumeSkills } from "@/lib/matching/scorer";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 15;

const actions: AiAction[] = ["explain", "quiz", "evaluate", "follow-up", "revision", "coach", "lesson"];

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];

const text = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

function isAction(value: unknown): value is AiAction {
  return typeof value === "string" && actions.includes(value as AiAction);
}

function summary(value: string) {
  return value.replace(/\s+/g, " ").trim().slice(0, 1600);
}

export async function POST(request: Request) {
  try {
    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 16_000) {
      return Response.json({ error: "Request is too large." }, { status: 413 });
    }

    const body = await request.json() as Record<string, unknown>;
    const jobId = text(body.jobId, 200);
    const action = body.action;
    if (!jobId || !isAction(action)) {
      return Response.json({ error: "A valid jobId and action are required." }, { status: 400 });
    }

    const answer = text(body.answer, 12_000);
    if (action === "evaluate" && answer.length < 20) {
      return Response.json({ error: "Add a fuller answer before requesting evaluation." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    await consumeAllowance(user.id, "interview_ai");
    const [jobResult, profileResult, preferencesResult, resumeResult] = await Promise.all([
      supabase
        .from("jobs")
        .select("id,title,company_name,description,location,employment_type,seniority,skills")
        .eq("id", jobId)
        .maybeSingle(),
      supabase
        .from("profiles")
        .select("target_role,experience_years")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("job_preferences")
        .select("preferred_roles")
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("resumes")
        .select("parsed_data")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (jobResult.error) throw new Error(jobResult.error.message);
    if (!jobResult.data) return Response.json({ error: "Job not found." }, { status: 404 });

    const contextError = profileResult.error || preferencesResult.error || resumeResult.error;
    if (contextError) throw new Error(contextError.message);

    const job = jobResult.data;
    const parsedResume = (resumeResult.data?.parsed_data as ParsedResumeSkills | null) || null;
    const resumeSkills = getResumeSkills(parsedResume);
    const targetRole = profileResult.data?.target_role || strings(preferencesResult.data?.preferred_roles)[0] || null;
    const input: InterviewLearningInput = {
      job: {
        id: job.id,
        title: job.title || "",
        company: job.company_name || "",
        description: job.description || "",
        location: job.location || null,
        seniority: job.seniority || null,
        employmentType: job.employment_type || null,
        salary: null,
        skills: strings(job.skills),
      },
      candidate: {
        targetRole,
        experienceYears: profileResult.data?.experience_years ?? null,
        skills: resumeSkills,
        hasProfile: Boolean(profileResult.data),
        hasResume: Boolean(resumeResult.data),
        hasUsableResume: Boolean(resumeResult.data && resumeSkills.length),
      },
      matchScore: null,
      application: null,
    };
    const hub = generateInterviewPreparationHub(input);
    const topicId = text(body.topicId, 160);
    const topicName = text(body.topic, 160);
    const questionId = text(body.questionId, 160);
    const questionText = text(body.question, 2000);
    const topic = hub.learningTopics.find((item) => item.id === topicId || item.title === topicName) || hub.learningTopics[0] || null;
    const question = hub.questionBank.find((item) => item.id === questionId || item.question === questionText) || null;

    const aiContext: GroundedInterviewContext = {
      job: {
        title: input.job.title,
        company: input.job.company,
        descriptionSummary: summary(input.job.description),
        seniority: input.job.seniority,
        skills: input.job.skills,
      },
      candidate: {
        targetRole,
        experienceYears: input.candidate.experienceYears,
        skills: resumeSkills,
        resumeSignals: resumeSkills.slice(0, 12),
      },
      topic,
      question,
      answer: action === "evaluate" ? answer : null,
      weakAreas: hub.weakAreas,
    };

    const result = await runInterviewAiAction(action, aiContext);
    return Response.json({ success: true, ...result });
  } catch (error) {
    if (error instanceof AllowanceError) return Response.json({ error: error.message }, { status: error.status, headers: { "Cache-Control": "private, no-store" } });
    console.error("INTERVIEW AI ACTION ERROR:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Failed to run interview AI action." }, { status: 500 });
  }
}
