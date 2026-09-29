import { createClient } from "@/lib/supabase/server";
import { automaticFollowUp } from "@/lib/applications/follow-up";
import { isApplicationAnswer } from "@/lib/applications/package";
import { candidateAnswersWithFacts, parseApplicationFacts } from "@/lib/applications/facts";
import {
  canTransitionApplication,
  isApplicationStatus,
  isSubmittedApplication,
  type ApplicationStatus,
} from "@/lib/applications/lifecycle";
import {
  calculateMatchScore,
  getResumeSkills,
  type MatchJob,
  type MatchPreferences,
  type MatchProfile,
  type ParsedResumeSkills,
} from "@/lib/matching/scorer";

export const runtime = "nodejs";

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

    const [applicationsResult, profileResult, preferencesResult, resumesResult, packagesResult, autopilotResult] =
      await Promise.all([
        supabase
          .from("applications")
          .select(
            `
              id,
              job_id,
              status,
              version,
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
          .select("*")
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
        supabase.from("application_submissions")
          .select("job_id,resume_id,status,cover_note,application_answers,checklist,application_url")
          .eq("user_id", user.id),
        supabase.from("autopilot_preferences").select("work_authorization,notice_period")
          .eq("user_id", user.id).maybeSingle(),
      ]);

    const queryError = applicationsResult.error || profileResult.error ||
      preferencesResult.error || resumesResult.error || packagesResult.error || autopilotResult.error;
    if (queryError) throw new Error(queryError.message);

    const profile = profileResult.data;
    let applicationFacts;
    try { applicationFacts = parseApplicationFacts(profile?.application_facts); } catch { applicationFacts = {}; }
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

    const packages = new Map((packagesResult.data || []).map((item) => [item.job_id, {
      ...item,
      application_answers: Array.isArray(item.application_answers)
        ? item.application_answers.filter(isApplicationAnswer) : [],
    }]));
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
        application_package: packages.get(application.job_id) || null,
      };
    });

    return Response.json({
      success: true,
      applications,
      candidate_name: profile?.full_name || null,
      candidate_id: user.id,
      application_facts: applicationFacts,
      facts_storage_ready: profile ? Object.hasOwn(profile, "application_facts") : false,
      candidate_answers: candidateAnswersWithFacts([
        { question: "Full name", answer: profile?.full_name || "", source: "Profile" },
        { question: "Email", answer: user.email || "", source: "Account" },
        { question: "Current location", answer: profile?.location || "", source: "Profile" },
        { question: "LinkedIn URL", answer: profile?.linkedin_url || "", source: "Profile" },
        { question: "GitHub URL", answer: profile?.github_url || "", source: "Profile" },
        { question: "Phone", answer: primaryResume?.parsed_data?.personalInfo?.phone || "", source: "Primary resume — verify" },
      ].filter((item) => typeof item.answer === "string" && item.answer.trim()).concat([
        { question: "Work authorization", answer: autopilotResult.data?.work_authorization || "", source: "Current Autopilot settings — verify for this employer" },
        { question: "Notice period", answer: autopilotResult.data?.notice_period || "", source: "Current Autopilot settings — verify for this employer" },
      ]), applicationFacts),
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
        : "saved";
    const submissionConfirmed = input.submissionConfirmed === true;

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

    if (!isApplicationStatus(status)) {
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
          version,
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
    const now = new Date();

    if (existing) {
      if (existing.status === status) {
        return Response.json({ success: true, created: false, alreadyExists: true, application: existing });
      }
      if (!canTransitionApplication(existing.status as ApplicationStatus, status)) {
        return Response.json({ error: "Invalid application status transition." }, { status: 400 });
      }
      // Legacy entry points confirm a prepared application through POST. They must
      // supply both explicit confirmation and the version they actually reviewed.
      if (existing.status === "saved" && status === "applied") {
        if (!submissionConfirmed) {
          return Response.json({ error: "Confirm successful employer submission before marking this application applied." }, { status: 400 });
        }
        if (!Number.isSafeInteger(input.version) || Number(input.version) < 1) {
          return Response.json({ error: "Reload this application before confirming submission." }, { status: 409 });
        }
        const { data: confirmed, error: confirmationError } = await supabase
          .from("applications")
          .update({
            status,
            applied_at: existing.applied_at || now.toISOString(),
            follow_up_at: "followUpAt" in input ? followUpAt : automaticFollowUp(status as ApplicationStatus, existing.follow_up_at, existing.applied_at, now),
            version: existing.version + 1,
            updated_at: now.toISOString(),
          })
          .eq("id", existing.id)
          .eq("user_id", user.id)
          .eq("status", "saved")
          .eq("version", input.version)
          .select("id,job_id,status,version,applied_at,follow_up_at,notes,resume_id,created_at,updated_at")
          .maybeSingle();
        if (confirmationError) throw new Error(confirmationError.message);
        if (!confirmed) return Response.json({ error: "Application changed. Refresh and retry." }, { status: 409 });
        return Response.json({ success: true, created: false, alreadyExists: true, application: confirmed });
      }
      return Response.json({ error: "Use the application update action to change its lifecycle stage." }, { status: 400 });
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

    if (status !== "saved" && status !== "applied") {
      return Response.json({ error: "A new application must start saved or be explicitly confirmed as applied." }, { status: 400 });
    }
    if (status === "applied" && !submissionConfirmed) {
      return Response.json({ error: "Confirm successful employer submission before marking this application applied." }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("applications")
      .insert({
        user_id: user.id,
        job_id: jobId,
        status,
        applied_at: isSubmittedApplication(status)
          ? now.toISOString()
          : null,
        follow_up_at: "followUpAt" in input ? followUpAt : automaticFollowUp(status as ApplicationStatus, null, null, now),
        notes,
        resume_id: resumeId,
      })
      .select(
        `
          id,
          job_id,
          status,
          version,
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

    if (!Number.isSafeInteger(input.version) || Number(input.version) < 1) {
      return Response.json({ error: "A current application version is required." }, { status: 400 });
    }

    const { data: currentApplication, error: currentError } = await supabase
      .from("applications")
      .select("applied_at,follow_up_at,status,version")
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
    if (currentApplication.version !== input.version) {
      return Response.json({ error: "Application changed in another tab. Refresh and retry." }, { status: 409 });
    }

    const updates: Record<
      string,
      string | number | null
    > = {};
    const now = new Date();

    if (typeof input.status === "string") {
      const status =
        input.status.trim();

      if (!isApplicationStatus(status)) {
        return Response.json(
          { error: "Invalid application status." },
          { status: 400 },
        );
      }

      if (!canTransitionApplication(currentApplication.status as ApplicationStatus, status)) {
        return Response.json({ error: "Invalid application status transition." }, { status: 400 });
      }
      if (currentApplication.status === "saved" && status === "applied" && input.submissionConfirmed !== true) {
        return Response.json({ error: "Confirm successful employer submission before marking this application applied." }, { status: 400 });
      }

      updates.status = status;
      if (!("followUpAt" in input)) {
        updates.follow_up_at = automaticFollowUp(
          status as ApplicationStatus,
          currentApplication.follow_up_at,
          currentApplication.applied_at,
          now,
        );
      }

      if (!currentApplication.applied_at && isSubmittedApplication(status)) {
        updates.applied_at =
          now.toISOString();
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

    updates.updated_at = now.toISOString();
    updates.version = currentApplication.version + 1;

    const { data, error } = await supabase
      .from("applications")
      .update(updates)
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .eq("version", input.version)
      .select(
        `
          id,
          job_id,
          status,
          version,
          applied_at,
          follow_up_at,
          notes,
          resume_id,
          created_at,
          updated_at
        `,
      )
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }
    if (!data) {
      return Response.json({ error: "Application changed in another tab. Refresh and retry." }, { status: 409 });
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
