import { generateApplicationCopilot } from "@/lib/ai/application-copilot";
import {
  calculateMatchScore,
  type MatchPreferences,
  type MatchProfile,
} from "@/lib/matching/scorer";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function strings(value: unknown) {
  return Array.isArray(value)
    ? value.map(text).filter(Boolean)
    : [];
}

function normalizeExperience(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => {
    const descriptions = typeof item.description === "string"
      ? [text(item.description)].filter(Boolean)
      : strings(item.description);
    const duration = text(item.duration) || [text(item.startDate), text(item.endDate)]
      .filter(Boolean).join(" – ");
    return {
      role: text(item.role),
      company: text(item.company),
      duration,
      descriptions,
    };
  }).filter((item) => item.role || item.company || item.descriptions.length);
}

function normalizeProjects(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter(isRecord).map((item) => ({
    name: text(item.name),
    description: typeof item.description === "string"
      ? text(item.description)
      : strings(item.description).join(" "),
  })).filter((item) => item.name || item.description);
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "You must be logged in.", code: "UNAUTHORIZED" }, { status: 401 });
    }

    const { id: rawId } = await context.params;
    const id = rawId?.trim();
    if (!id || id.length > 200) {
      return Response.json({ error: "Job ID is required.", code: "INVALID_JOB" }, { status: 400 });
    }

    const [jobResult, profileResult, preferencesResult, resumesResult, applicationResult, savedResult] =
      await Promise.all([
        supabase.from("jobs").select(
          "id,title,company_name,description,location,country,seniority,employment_type,skills,salary_min,salary_max,salary_currency,application_url,source_url,source,published_at",
        ).eq("id", id).maybeSingle(),
        supabase.from("profiles").select(
          "full_name,target_role,experience_years,location",
        ).eq("id", user.id).maybeSingle(),
        supabase.from("job_preferences").select(
          "preferred_roles,preferred_locations,remote_only,employment_types,minimum_salary,preferred_countries",
        ).eq("user_id", user.id).maybeSingle(),
        supabase.from("resumes").select(
          "id,file_name,is_primary,parsed_data,created_at",
        ).eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("applications").select(
          "id,job_id,status,applied_at,follow_up_at,notes,resume_id,created_at,updated_at",
        ).eq("user_id", user.id).eq("job_id", id).maybeSingle(),
        supabase.from("saved_jobs").select("job_id")
          .eq("user_id", user.id).eq("job_id", id).maybeSingle(),
      ]);

    const queryError = jobResult.error || profileResult.error || preferencesResult.error ||
      resumesResult.error || applicationResult.error || savedResult.error;
    if (queryError) throw new Error(queryError.message);

    const job = jobResult.data;
    if (!job) return Response.json({ error: "Job not found.", code: "JOB_NOT_FOUND" }, { status: 404 });
    if (!text(job.title) || !text(job.company_name)) {
      return Response.json({ error: "This job does not contain enough information for Copilot.", code: "INVALID_JOB" }, { status: 422 });
    }

    const resumes = resumesResult.data || [];
    const primaryResume = resumes.find((resume) => resume.is_primary) || null;
    if (!primaryResume) {
      return Response.json({ error: "Add a primary resume to use Application Copilot.", code: "NO_RESUME" }, { status: 422 });
    }
    if (!isRecord(primaryResume.parsed_data)) {
      return Response.json({ error: "Your primary resume could not be read. Review or upload it again.", code: "INVALID_RESUME" }, { status: 422 });
    }

    const parsed = primaryResume.parsed_data;
    const skillGroups = isRecord(parsed.skills) ? parsed.skills : {};
    const skills = Array.from(new Set([
      ...strings(skillGroups.frontend),
      ...strings(skillGroups.backend),
      ...strings(skillGroups.database),
      ...strings(skillGroups.tools),
      ...strings(skillGroups.other),
    ]));
    const experience = normalizeExperience(parsed.experience);
    const projects = normalizeProjects(parsed.projects);
    const summary = text(parsed.summary);

    if (!summary && !skills.length && !experience.length && !projects.length) {
      return Response.json({ error: "Your primary resume is empty or incomplete. Review it before using Copilot.", code: "EMPTY_RESUME" }, { status: 422 });
    }

    const personalInfo = isRecord(parsed.personalInfo) ? parsed.personalInfo : {};
    const profile = profileResult.data;
    const years = Number(profile?.experience_years ?? 0);
    const candidate = {
      name: text(profile?.full_name) || text(personalInfo.name) || "Candidate",
      targetRole: text(profile?.target_role),
      experienceYears: Number.isFinite(years) && years >= 0 ? years : 0,
      location: text(profile?.location) || text(personalInfo.location),
      skills,
      summary,
      experience,
      projects,
    };
    const jobSkills = strings(job.skills);
    const result = generateApplicationCopilot({
      job: {
        title: text(job.title),
        company: text(job.company_name),
        description: text(job.description),
        location: text(job.location),
        seniority: text(job.seniority),
        employmentType: text(job.employment_type),
        skills: jobSkills,
      },
      candidate,
    });

    const preferences = preferencesResult.data;
    let match = null;
    if (preferences) {
      const matchProfile: MatchProfile = {
        target_role: candidate.targetRole || null,
        experience_years: candidate.experienceYears,
        location: candidate.location || null,
        skills,
      };
      const matchPreferences: MatchPreferences = {
        preferred_roles: preferences.preferred_roles || [],
        preferred_locations: preferences.preferred_locations || [],
        remote_only: preferences.remote_only ?? false,
        employment_types: preferences.employment_types || [],
        minimum_salary: preferences.minimum_salary ?? null,
        preferred_countries: preferences.preferred_countries || [],
      };
      match = calculateMatchScore({
        title: job.title,
        description: job.description,
        location: job.location,
        country: job.country,
        employment_type: job.employment_type,
        seniority: job.seniority,
        salary_min: job.salary_min,
        salary_max: job.salary_max,
        skills: jobSkills,
      }, matchProfile, matchPreferences);
    }

    const application = applicationResult.data;
    const resumeUsed = application?.resume_id
      ? resumes.find((resume) => resume.id === application.resume_id)
      : null;

    return Response.json({
      success: true,
      job,
      result,
      match,
      saved: Boolean(savedResult.data),
      application: application ? {
        ...application,
        resume: resumeUsed ? { id: resumeUsed.id, file_name: resumeUsed.file_name } : null,
      } : null,
      resume: {
        id: primaryResume.id,
        file_name: primaryResume.file_name,
        is_primary: primaryResume.is_primary,
      },
    });
  } catch (error) {
    console.error("APPLICATION COPILOT ERROR:", error);
    return Response.json({ error: "Application Copilot is temporarily unavailable." }, { status: 500 });
  }
}
