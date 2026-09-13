import { createClient } from "@/lib/supabase/server";
import {
  calculateMatchScore,
  getResumeSkills,
  type MatchJob,
  type MatchPreferences,
  type MatchProfile,
  type ParsedResumeSkills,
} from "@/lib/matching/scorer";

export const runtime = "nodejs";

type JobRow = MatchJob & {
  id: string;
  external_id: string;
  title: string;
  company_name: string;
  application_url: string | null;
  source_url: string | null;
  source: string;
  published_at: string | null;
};

function normalizeCompanyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      throw new Error(userError.message);
    }

    if (!user) {
      return Response.json(
        {
          error: "You must be logged in.",
        },
        { status: 401 },
      );
    }

    const [
      { data: profile, error: profileError },
      { data: preferences, error: preferencesError },
      { data: resume, error: resumeError },
      { data: jobs, error: jobsError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "target_role,experience_years,location,current_company",
        )
        .eq("id", user.id)
        .maybeSingle(),

      supabase
        .from("job_preferences")
        .select(
          "preferred_roles,preferred_locations,remote_only,employment_types,minimum_match_score,minimum_salary,preferred_countries",
        )
        .eq("user_id", user.id)
        .maybeSingle(),

      supabase
        .from("resumes")
        .select("parsed_data,is_primary")
        .eq("user_id", user.id)
        .eq("is_primary", true)
        .order("created_at", {
          ascending: false,
        })
        .limit(1)
        .maybeSingle(),

      supabase
        .from("jobs")
        .select(
          "id,external_id,title,company_name,description,location,country,employment_type,seniority,salary_min,salary_max,salary_currency,application_url,source_url,source,published_at,skills",
        )
        .order("published_at", {
          ascending: false,
          nullsFirst: false,
        })
        .limit(100),
    ]);

    if (profileError) {
      throw new Error(
        `Failed to load profile: ${profileError.message}`,
      );
    }

    if (!profile) {
      return Response.json(
        {
          error: "Complete your profile before discovering jobs.",
          code: "PROFILE_REQUIRED",
        },
        { status: 400 },
      );
    }

    if (preferencesError) {
      throw new Error(
        `Failed to load preferences: ${preferencesError.message}`,
      );
    }

    if (resumeError) {
      throw new Error(
        `Failed to load resume: ${resumeError.message}`,
      );
    }

    if (jobsError) {
      throw new Error(
        `Failed to load jobs: ${jobsError.message}`,
      );
    }

    if (!preferences) {
      return Response.json(
        {
          error: "Set your job preferences before discovering jobs.",
          code: "PREFERENCES_REQUIRED",
        },
        { status: 400 },
      );
    }

    const parsedData =
      (resume?.parsed_data as ParsedResumeSkills | null) ||
      null;

    const resumeSkills =
      getResumeSkills(parsedData);

    const matchProfile: MatchProfile = {
      target_role:
        profile.target_role || null,
      experience_years:
        profile.experience_years ?? null,
      location:
        profile.location || null,
      skills: resumeSkills,
    };

    const matchPreferences: MatchPreferences = {
      preferred_roles:
        preferences.preferred_roles || [],
      preferred_locations:
        preferences.preferred_locations || [],
      remote_only:
        preferences.remote_only ?? false,
      employment_types:
        preferences.employment_types || [],
      minimum_salary:
        preferences.minimum_salary ?? null,
      preferred_countries:
        preferences.preferred_countries || [],
    };

    const excludedCompany =
      normalizeCompanyName(
        profile.current_company || "",
      );

    const scoredJobs = (
      (jobs || []) as JobRow[]
    )
      .filter((job) => {
        if (!excludedCompany) {
          return true;
        }

        return (
          normalizeCompanyName(
            job.company_name || "",
          ) !== excludedCompany
        );
      })
      .map((job) => {
        const result =
          calculateMatchScore(
            job,
            matchProfile,
            matchPreferences,
          );

        return {
          ...job,
          match_score: result.score,
          match_breakdown:
            result.breakdown,
        };
      })
      .sort(
        (a, b) =>
          b.match_score -
          a.match_score,
      );

    const storedMinimum = Number(
      preferences.minimum_match_score ?? 70,
    );
    const minimumMatchScore = Number.isFinite(storedMinimum)
      ? Math.min(100, Math.max(0, storedMinimum))
      : 70;

    const filteredJobs = scoredJobs.filter(
      (job) => job.match_score >= minimumMatchScore,
    );

    return Response.json({
      success: true,
      total_jobs: filteredJobs.length,
      total_scored_jobs: scoredJobs.length,
      resume_skills: resumeSkills,
      minimum_match_score: minimumMatchScore,
      has_resume: Boolean(resume),
      jobs: filteredJobs,
    });
  } catch (error) {
    console.error(
      "JOB MATCH ERROR:",
      error,
    );

    return Response.json(
      {
        error: "Failed to calculate job matches.",
      },
      { status: 500 },
    );
  }
}
