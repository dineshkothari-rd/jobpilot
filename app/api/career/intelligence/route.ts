import { generateCareerIntelligence, type CareerJob } from "@/lib/ai/career-intelligence";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "You must be logged in." }, { status: 401 });
    }

    const [
      profileResult,
      preferencesResult,
      resumeResult,
      jobsResult,
      applicationsResult,
      savedJobsResult,
    ] = await Promise.all([
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
        .from("jobs")
        .select("id,title,company_name,description,location,country,employment_type,seniority,salary_min,salary_max,skills,published_at")
        .order("published_at", { ascending: false, nullsFirst: false })
        .limit(120),
      supabase
        .from("applications")
        .select("id,job_id,status,follow_up_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false })
        .limit(100),
      supabase
        .from("saved_jobs")
        .select("job_id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

    const queryError = profileResult.error || preferencesResult.error || resumeResult.error ||
      jobsResult.error || applicationsResult.error || savedJobsResult.error;
    if (queryError) throw new Error(queryError.message);

    const intelligence = generateCareerIntelligence({
      profile: profileResult.data
        ? {
            target_role: profileResult.data.target_role || null,
            experience_years: profileResult.data.experience_years ?? null,
            location: profileResult.data.location || null,
          }
        : null,
      preferences: preferencesResult.data
        ? {
            preferred_roles: strings(preferencesResult.data.preferred_roles),
            preferred_locations: strings(preferencesResult.data.preferred_locations),
            remote_only: preferencesResult.data.remote_only ?? false,
            employment_types: strings(preferencesResult.data.employment_types),
            minimum_salary: preferencesResult.data.minimum_salary ?? null,
            preferred_countries: strings(preferencesResult.data.preferred_countries),
          }
        : null,
      resume: resumeResult.data
        ? {
            file_name: resumeResult.data.file_name || null,
            parsed_data: resumeResult.data.parsed_data || null,
          }
        : null,
      jobs: ((jobsResult.data || []) as CareerJob[]).map((job) => ({
        ...job,
        skills: strings(job.skills),
      })),
      applications: (applicationsResult.data || []).map((application) => ({
        id: application.id,
        job_id: application.job_id,
        status: application.status || null,
        follow_up_at: application.follow_up_at || null,
      })),
      savedJobCount: savedJobsResult.count || 0,
    });

    return Response.json({
      success: true,
      intelligence,
    });
  } catch (error) {
    console.error("CAREER INTELLIGENCE ERROR:", error);
    return Response.json({ error: "Failed to load Career Intelligence." }, { status: 500 });
  }
}
