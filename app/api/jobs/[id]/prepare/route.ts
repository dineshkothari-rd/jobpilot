import {
  generateInterviewPreparationHub,
  type InterviewLearningInput,
} from "@/lib/ai/interview-learning";
import { getAiProviderStatus } from "@/lib/ai/providers/provider-factory";
import {
  calculateMatchScore,
  getResumeSkills,
  type MatchJob,
  type MatchPreferences,
  type MatchProfile,
  type ParsedResumeSkills,
} from "@/lib/matching/scorer";
import { getResourceProviderStatus } from "@/lib/resources/resource-provider-factory";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type JobRow = MatchJob & {
  id: string;
  title: string | null;
  company_name: string | null;
  salary_currency: string | null;
  application_url: string | null;
  source_url: string | null;
  source: string | null;
  published_at: string | null;
};

type RouteContext = {
  params: Promise<{ id: string }>;
};

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];

function formatSalary(job: JobRow) {
  const min = job.salary_min;
  const max = job.salary_max;
  if (min == null && max == null) return null;

  const currency = job.salary_currency || "";
  const format = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: 0 });

  if (min != null && max != null) return `${currency} ${format(min)} - ${format(max)}`.trim();
  if (min != null) return `${currency} ${format(min)}+`.trim();
  return `Up to ${currency} ${format(max as number)}`.trim();
}

export async function GET(
  _request: Request,
  context: RouteContext,
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id: rawId } = await context.params;
    const id = rawId?.trim();
    if (!id || id.length > 200) {
      return Response.json({ error: "A valid job ID is required." }, { status: 400 });
    }

    const [
      jobResult,
      profileResult,
      preferencesResult,
      resumeResult,
      applicationResult,
    ] = await Promise.all([
      supabase
        .from("jobs")
        .select(
          "id,title,company_name,description,location,country,employment_type,seniority,salary_min,salary_max,salary_currency,application_url,source_url,source,published_at,skills",
        )
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
        .select("file_name,parsed_data")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("applications")
        .select("id,status,follow_up_at")
        .eq("user_id", user.id)
        .eq("job_id", id)
        .maybeSingle(),
    ]);

    if (jobResult.error) throw new Error(jobResult.error.message);
    if (!jobResult.data) {
      return Response.json({ error: "Job not found." }, { status: 404 });
    }

    const contextError = profileResult.error || preferencesResult.error ||
      resumeResult.error || applicationResult.error;
    if (contextError) throw new Error(contextError.message);

    const job = {
      ...(jobResult.data as JobRow),
      skills: strings(jobResult.data.skills),
    };
    const profile = profileResult.data;
    const preferences = preferencesResult.data;
    const parsedResume = (resumeResult.data?.parsed_data as ParsedResumeSkills | null) || null;
    const resumeSkills = getResumeSkills(parsedResume);
    const targetRole = profile?.target_role || strings(preferences?.preferred_roles)[0] || null;

    const matchProfile: MatchProfile = {
      target_role: targetRole,
      experience_years: profile?.experience_years ?? null,
      location: profile?.location ?? null,
      skills: resumeSkills,
    };
    const matchPreferences: MatchPreferences = {
      preferred_roles: strings(preferences?.preferred_roles),
      preferred_locations: strings(preferences?.preferred_locations),
      remote_only: preferences?.remote_only ?? false,
      employment_types: strings(preferences?.employment_types),
      minimum_salary: preferences?.minimum_salary ?? null,
      preferred_countries: strings(preferences?.preferred_countries),
    };
    const match = profile && preferences
      ? calculateMatchScore(job, matchProfile, matchPreferences)
      : null;
    const application = applicationResult.data
      ? {
          id: applicationResult.data.id,
          status: applicationResult.data.status,
          follow_up_at: applicationResult.data.follow_up_at,
        }
      : null;

    const hub = generateInterviewPreparationHub({
      job: {
        id: job.id,
        title: job.title || "",
        company: job.company_name || "",
        description: job.description || "",
        location: job.location || null,
        seniority: job.seniority || null,
        employmentType: job.employment_type || null,
        salary: formatSalary(job),
        skills: job.skills || [],
      },
      candidate: {
        targetRole,
        experienceYears: profile?.experience_years ?? null,
        skills: resumeSkills,
        hasProfile: Boolean(profile),
        hasResume: Boolean(resumeResult.data),
        hasUsableResume: Boolean(resumeResult.data && resumeSkills.length),
      },
      matchScore: match?.score ?? null,
      application,
    } satisfies InterviewLearningInput);

    return Response.json({
      success: true,
      job,
      matchScore: match?.score ?? null,
      matchBreakdown: match?.breakdown ?? null,
      application,
      context: {
        hasProfile: Boolean(profile),
        hasResume: Boolean(resumeResult.data),
        hasUsableResume: Boolean(resumeResult.data && resumeSkills.length),
        targetRole,
        resumeName: resumeResult.data?.file_name || null,
      },
      preparation: hub.preparation,
      hub,
      providerStatus: {
        ai: getAiProviderStatus(),
        resources: getResourceProviderStatus(),
      },
    });
  } catch (error) {
    console.error("JOB PREPARATION API ERROR:", error);
    return Response.json({ error: "Failed to generate preparation." }, { status: 500 });
  }
}
