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

const allowedStatuses = [
  "saved",
  "applied",
  "screening",
  "interview",
  "offer",
  "rejected",
  "withdrawn",
] as const;

type ApplicationStatus =
  (typeof allowedStatuses)[number];

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json(
        { error: "You must be logged in." },
        { status: 401 },
      );
    }

    const [applicationsResult, profileResult, preferencesResult, resumesResult] =
      await Promise.all([
        supabase
          .from("applications")
          .select(
            `
              id,
              job_id,
              status,
              applied_at,
              follow_up_at,
              notes,
              resume_id,
              created_at,
              updated_at,
              jobs (
                id,
                title,
                company_name,
                description,
                location,
                country,
                employment_type,
                seniority,
                salary_min,
                salary_max,
                salary_currency,
                application_url,
                source_url,
                source,
                published_at,
                skills
              )
            `,
          )
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false }),
        supabase
          .from("profiles")
          .select("full_name,target_role,experience_years,location")
          .eq("id", user.id)
          .maybeSingle(),
        supabase
          .from("job_preferences")
          .select(
            "preferred_roles,preferred_locations,remote_only,employment_types,minimum_salary,preferred_countries",
          )
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("resumes")
          .select("id,file_name,is_primary,parsed_data,created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
      ]);

    const queryError = applicationsResult.error || profileResult.error ||
      preferencesResult.error || resumesResult.error;
    if (queryError) throw new Error(queryError.message);

    const profile = profileResult.data;
    const preferences = preferencesResult.data;
    const resumes = resumesResult.data || [];
    const primaryResume = resumes.find((resume) => resume.is_primary) || null;
    const resumeSkills = getResumeSkills(
      (primaryResume?.parsed_data as ParsedResumeSkills | null) || null,
    );
    const matchProfile: MatchProfile = {
      target_role: profile?.target_role || null,
      experience_years: profile?.experience_years ?? null,
      location: profile?.location || null,
      skills: resumeSkills,
    };
    const matchPreferences: MatchPreferences | null = preferences ? {
      preferred_roles: preferences.preferred_roles || [],
      preferred_locations: preferences.preferred_locations || [],
      remote_only: preferences.remote_only ?? false,
      employment_types: preferences.employment_types || [],
      minimum_salary: preferences.minimum_salary ?? null,
      preferred_countries: preferences.preferred_countries || [],
    } : null;

    const applications = (applicationsResult.data || []).map((application) => {
      const relation = application.jobs;
      const job = Array.isArray(relation) ? relation[0] || null : relation;
      const match = job && matchPreferences
        ? calculateMatchScore(job as MatchJob, matchProfile, matchPreferences)
        : null;

      return {
        ...application,
        match_score: match?.score ?? null,
        match_breakdown: match?.breakdown ?? null,
      };
    });

    return Response.json({
      success: true,
      applications,
      candidate_name: profile?.full_name || null,
      resumes: resumes.map(({ id, file_name, is_primary }) => ({
        id,
        file_name,
        is_primary,
      })),
    });
  } catch (error) {
    console.error(
      "APPLICATIONS GET ERROR:",
      error,
    );

    return Response.json(
      {
        error:
          "Failed to load applications.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json(
        { error: "You must be logged in." },
        { status: 401 },
      );
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "A valid JSON body is required." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    const jobId =
      typeof input.jobId === "string"
        ? input.jobId.trim()
        : "";

    const status =
      typeof input.status === "string"
        ? input.status.trim()
        : "applied";

    const notes =
      typeof input.notes === "string"
        ? input.notes.trim() || null
        : null;

    const resumeId =
      typeof input.resumeId === "string"
        ? input.resumeId.trim() || null
        : null;

    const followUpAt =
      typeof input.followUpAt === "string"
        ? input.followUpAt.trim() || null
        : null;

    if (!jobId || jobId.length > 200) {
      return Response.json(
        { error: "Job ID is required." },
        { status: 400 },
      );
    }

    if (notes && notes.length > 10_000) {
      return Response.json({ error: "Notes must be 10,000 characters or fewer." }, { status: 400 });
    }

    if (
      !allowedStatuses.includes(
        status as ApplicationStatus,
      )
    ) {
      return Response.json(
        { error: "Invalid application status." },
        { status: 400 },
      );
    }

    if (followUpAt && Number.isNaN(Date.parse(followUpAt))) {
      return Response.json(
        { error: "Invalid follow-up date." },
        { status: 400 },
      );
    }

    const { data: existing, error: existingError } = await supabase
      .from("applications")
      .select(
        `
          id,
          job_id,
          status,
          applied_at,
          follow_up_at,
          notes,
          resume_id,
          created_at,
          updated_at
        `,
      )
      .eq("user_id", user.id)
      .eq("job_id", jobId)
      .maybeSingle();

    if (existingError) throw new Error(existingError.message);

    if (existing) {
      return Response.json({
        success: true,
        created: false,
        alreadyExists: true,
        application: existing,
      });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw new Error(jobError.message);
    if (!job) {
      return Response.json({ error: "Job not found." }, { status: 404 });
    }

    if (resumeId) {
      const { data: resume, error: resumeError } = await supabase
        .from("resumes")
        .select("id")
        .eq("id", resumeId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (resumeError) throw new Error(resumeError.message);

      if (!resume) {
        return Response.json(
          { error: "Invalid resume." },
          { status: 400 },
        );
      }
    }

    const isApplied =
      status === "applied" ||
      status === "screening" ||
      status === "interview" ||
      status === "offer";

    const { data, error } = await supabase
      .from("applications")
      .insert({
        user_id: user.id,
        job_id: jobId,
        status,
        applied_at: isApplied
          ? new Date().toISOString()
          : null,
        follow_up_at: followUpAt,
        notes,
        resume_id: resumeId,
      })
      .select(
        `
          id,
          job_id,
          status,
          applied_at,
          follow_up_at,
          notes,
          resume_id,
          created_at,
          updated_at
        `,
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({
      success: true,
      created: true,
      alreadyExists: false,
      application: data,
    });
  } catch (error) {
    console.error(
      "APPLICATIONS POST ERROR:",
      error,
    );

    return Response.json(
      {
        error:
          "Failed to create application.",
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json(
        { error: "You must be logged in." },
        { status: 401 },
      );
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "A valid JSON body is required." }, { status: 400 });
    }
    const input = body as Record<string, unknown>;

    const applicationId =
      typeof input.applicationId === "string"
        ? input.applicationId.trim()
        : "";

    if (!applicationId || applicationId.length > 200) {
      return Response.json(
        { error: "Application ID is required." },
        { status: 400 },
      );
    }

    const { data: currentApplication, error: currentError } = await supabase
      .from("applications")
      .select("applied_at")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (currentError) throw new Error(currentError.message);
    if (!currentApplication) {
      return Response.json(
        { error: "Application not found." },
        { status: 404 },
      );
    }

    const updates: Record<
      string,
      string | null
    > = {};

    if (typeof input.status === "string") {
      const status =
        input.status.trim();

      if (
        !allowedStatuses.includes(
          status as ApplicationStatus,
        )
      ) {
        return Response.json(
          { error: "Invalid application status." },
          { status: 400 },
        );
      }

      updates.status = status;

      if (!currentApplication.applied_at && (
        status === "applied" ||
        status === "screening" ||
        status === "interview" ||
        status === "offer"
      )) {
        updates.applied_at =
          new Date().toISOString();
      }
    }

    if (
      typeof input.notes === "string" ||
      input.notes === null
    ) {
      updates.notes =
        typeof input.notes === "string"
          ? input.notes.trim() || null
          : null;

      if (updates.notes && updates.notes.length > 10_000) {
        return Response.json({ error: "Notes must be 10,000 characters or fewer." }, { status: 400 });
      }
    }

    if (
      typeof input.followUpAt === "string" ||
      input.followUpAt === null
    ) {
      const followUpAt =
        typeof input.followUpAt === "string"
          ? input.followUpAt.trim() || null
          : null;

      if (followUpAt && Number.isNaN(Date.parse(followUpAt))) {
        return Response.json(
          { error: "Invalid follow-up date." },
          { status: 400 },
        );
      }

      updates.follow_up_at = followUpAt;
    }

    if (
      typeof input.resumeId === "string" ||
      input.resumeId === null
    ) {
      const resumeId =
        typeof input.resumeId === "string"
          ? input.resumeId.trim() || null
          : null;

      if (resumeId) {
        const { data: resume, error: resumeError } =
          await supabase
            .from("resumes")
            .select("id")
            .eq("id", resumeId)
            .eq("user_id", user.id)
            .maybeSingle();

        if (resumeError) throw new Error(resumeError.message);

        if (!resume) {
          return Response.json(
            { error: "Invalid resume." },
            { status: 400 },
          );
        }
      }

      updates.resume_id = resumeId;
    }

    if (Object.keys(updates).length === 0) {
      return Response.json(
        { error: "No changes provided." },
        { status: 400 },
      );
    }

    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from("applications")
      .update(updates)
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .select(
        `
          id,
          job_id,
          status,
          applied_at,
          follow_up_at,
          notes,
          resume_id,
          created_at,
          updated_at
        `,
      )
      .single();

    if (error) {
      throw new Error(error.message);
    }

    return Response.json({
      success: true,
      application: data,
    });
  } catch (error) {
    console.error(
      "APPLICATIONS PATCH ERROR:",
      error,
    );

    return Response.json(
      {
        error:
          "Failed to update application.",
      },
      { status: 500 },
    );
  }
}
