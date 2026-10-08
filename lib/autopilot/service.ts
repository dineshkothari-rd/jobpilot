import "server-only";
import { AllowanceError, consumeAllowance } from "../plans/server";
import { shouldPrepare } from "./schedule";
import { candidateAnswersWithFacts } from "../applications/facts";

import { generateApplicationCopilot } from "../ai/application-copilot";
import {
  calculateMatchScore,
  getResumeSkills,
  type MatchJob,
} from "../matching/scorer";
import type { ServerSupabaseClient } from "../supabase/server";
import {
  evaluateAutoApply,
  type AutopilotPreferences,
} from "./eligibility";
import {
  preferencesFromRow,
} from "./preferences";

type UnknownRow = Record<string, unknown>;

export class AutopilotRunError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const text = (value: unknown) =>
  typeof value === "string" ? value.trim() : "";

const stringList = (value: unknown) =>
  Array.isArray(value) ? value.map(text).filter(Boolean) : [];

const isRecord = (value: unknown): value is UnknownRow =>
  typeof value === "object" && value !== null;

const submittedApplicationStatuses = new Set([
  "applied",
  "screening",
  "interview",
  "offer",
]);

function locationMatches(
  preferences: AutopilotPreferences,
  job: UnknownRow,
) {
  if (!preferences.locations.length) return true;

  const jobLocation = `${text(job.location)} ${text(job.country)}`.toLowerCase();
  if (
    jobLocation.includes("remote") &&
    preferences.workplaceModes.includes("remote")
  ) {
    return true;
  }

  return preferences.locations.some((location) => {
    const expected = location.toLowerCase();
    return expected === "remote"
      ? jobLocation.includes("remote")
      : jobLocation.includes(expected);
  });
}

function workplaceMatches(
  preferences: AutopilotPreferences,
  job: UnknownRow,
) {
  if (!preferences.workplaceModes.length) return true;

  const location = text(job.location).toLowerCase();
  if (location.includes("remote")) {
    return preferences.workplaceModes.includes("remote");
  }
  if (location.includes("hybrid")) {
    return preferences.workplaceModes.includes("hybrid");
  }
  return preferences.workplaceModes.includes("on-site");
}

function candidateFrom(parsed: UnknownRow, profile: UnknownRow) {
  const skillGroups = isRecord(parsed.skills) ? parsed.skills : {};
  const experience = Array.isArray(parsed.experience)
    ? parsed.experience.filter(isRecord).map((item) => ({
        role: text(item.role),
        company: text(item.company),
        duration:
          text(item.duration) ||
          [text(item.startDate), text(item.endDate)].filter(Boolean).join(" – "),
        descriptions:
          typeof item.description === "string"
            ? [text(item.description)]
            : stringList(item.description),
      }))
    : [];
  const projects = Array.isArray(parsed.projects)
    ? parsed.projects.filter(isRecord).map((item) => ({
        name: text(item.name),
        description:
          typeof item.description === "string"
            ? text(item.description)
            : stringList(item.description).join(" "),
      }))
    : [];
  const personal = isRecord(parsed.personalInfo) ? parsed.personalInfo : {};

  return {
    name: text(profile.full_name) || text(personal.name) || "Candidate",
    targetRole: text(profile.target_role),
    experienceYears: Math.max(0, Number(profile.experience_years) || 0),
    location: text(profile.location) || text(personal.location),
    skills: [
      ...new Set([
        ...stringList(skillGroups.frontend),
        ...stringList(skillGroups.backend),
        ...stringList(skillGroups.database),
        ...stringList(skillGroups.tools),
        ...stringList(skillGroups.other),
      ]),
    ],
    summary: text(parsed.summary),
    experience,
    projects,
  };
}

function firstQueryError(results: Array<{ error: { message: string } | null }>) {
  return results.find((result) => result.error)?.error || null;
}

type RunContext = {
  supabase: ServerSupabaseClient;
  userId: string;
  preferences: AutopilotPreferences;
  profile: UnknownRow;
  resume: UnknownRow | null;
  parsedResume: UnknownRow | null;
  candidate: ReturnType<typeof candidateFrom> | null;
  applications: Map<string, UnknownRow>;
  submissions: Map<string, UnknownRow>;
  savedJobs: Set<string>;
  appliedToday: number;
};

async function prepareAssistedApplication(
  context: RunContext,
  job: UnknownRow & { matchScore: number },
  actionId: string,
) {
  const {
    supabase,
    userId,
    preferences,
    profile,
    resume,
    parsedResume,
    candidate,
  } = context;
  if (!resume || !parsedResume || !candidate) {
    throw new Error("A valid primary resume and candidate profile are required.");
  }

  const existingSubmission = context.submissions.get(text(job.id));
  let resumeId = text(existingSubmission?.resume_id) || text(resume.id);
  let createdResumeId = "";
  let submissionSaved = false;

  try {
    const applicationPackage = generateApplicationCopilot({
      job: {
        title: text(job.title),
        company: text(job.company_name),
        description: text(job.description),
        location: text(job.location),
        seniority: text(job.seniority),
        employmentType: text(job.employment_type),
        skills: stringList(job.skills),
      },
      candidate,
    });

    if (!text(existingSubmission?.resume_id)) {
      const now = new Date().toISOString();
      const { data: copy, error: copyError } = await supabase
        .from("resumes")
        .insert({
          user_id: userId,
          file_name: `${text(resume.file_name).replace(/\.[^.]+$/, "")} — ${text(job.company_name)}`,
          file_path: resume.file_path,
          file_size: resume.file_size,
          mime_type: resume.mime_type,
          raw_text: resume.raw_text,
          parsed_data: {
            ...parsedResume,
            summary: applicationPackage.tailoredSummary,
            studio: {
              targetDescription: text(job.description).slice(0, 30_000),
              sourceResumeId: resume.id,
              sourceSnapshot: parsedResume,
              updatedAt: now,
            },
          },
          is_primary: false,
        })
        .select("id")
        .single();
      if (copyError) throw copyError;
      resumeId = copy.id;
      createdResumeId = copy.id;
    }

    const jobId = text(job.id);
    const { data: submission, error: submissionError } = await supabase
      .from("application_submissions")
      .upsert(
        {
          user_id: userId,
          job_id: jobId,
          resume_id: resumeId,
          automation_action_id: actionId,
          mode: "assisted",
          status: "prepared",
          cover_note: applicationPackage.coverLetter,
          application_answers: candidateAnswersWithFacts([
            {
              question: "Work authorization",
              answer: preferences.workAuthorization,
              source: "Autopilot preferences",
            },
            {
              question: "Notice period",
              answer: preferences.noticePeriod,
              source: "Autopilot preferences",
            },
          ], profile.application_facts),
          checklist: [
            "Review factual details",
            "Download the ATS-safe tailored resume",
            "Open the application link",
            "Confirm submission in Parth Careers",
          ],
          application_url: job.application_url,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,job_id" },
      )
      .select("id,job_id,resume_id,status,created_at")
      .single();
    if (submissionError) throw submissionError;
    submissionSaved = true;
    context.submissions.set(jobId, submission);

    if (!context.applications.has(jobId)) {
      const { data: application, error: applicationError } = await supabase
        .from("applications")
        .insert({
          user_id: userId,
          job_id: jobId,
          status: "saved",
          resume_id: resumeId,
        })
        .select("id,job_id,status,applied_at")
        .single();
      if (applicationError) throw applicationError;
      context.applications.set(jobId, application);
    }

    if (!context.savedJobs.has(jobId)) {
      const { error: saveError } = await supabase.from("saved_jobs").upsert(
        { user_id: userId, job_id: jobId },
        { onConflict: "user_id,job_id", ignoreDuplicates: true },
      );
      if (saveError) throw saveError;
      context.savedJobs.add(jobId);
    }

    return {
      resumeId,
      applicationId: text(context.applications.get(jobId)?.id) || null,
    };
  } catch (error) {
    if (createdResumeId && !submissionSaved) {
      await supabase
        .from("resumes")
        .delete()
        .eq("id", createdResumeId)
        .eq("user_id", userId);
    }
    throw error;
  }
}

async function updateAction(
  supabase: ServerSupabaseClient,
  userId: string,
  actionId: string,
  updates: UnknownRow,
) {
  const { data, error } = await supabase
    .from("automation_actions")
    .update(updates)
    .eq("id", actionId)
    .eq("user_id", userId)
    .select("id,status,reason")
    .single();
  if (error) throw error;
  return data;
}

async function executeAutopilot(
  supabase: ServerSupabaseClient,
  userId: string,
  retryId = "",
) {
  let retryAction: UnknownRow | null = null;
  if (retryId) {
    const { data, error } = await supabase
      .from("automation_actions")
      .select("id,job_id,retry_count")
      .eq("id", retryId)
      .eq("user_id", userId)
      .eq("status", "failed")
      .maybeSingle();
    if (error) throw error;
    if (!data?.job_id) {
      throw new AutopilotRunError("Failed automation not found.", 404);
    }
    retryAction = data;
  }

  const [
    settingsResult,
    basePreferencesResult,
    profileResult,
    resumeResult,
    jobsResult,
    applicationsResult,
    submissionsResult,
    savedJobsResult,
  ] = await Promise.all([
    supabase
      .from("autopilot_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("job_preferences")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("resumes")
      .select(
        "id,file_name,file_path,file_size,mime_type,raw_text,parsed_data,is_primary",
      )
      .eq("user_id", userId)
      .eq("is_primary", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("moderated_jobs")
      .select(
        "id,title,company_name,description,location,country,employment_type,seniority,salary_min,salary_max,salary_currency,application_url,source_url,source,published_at,skills,created_by,expires_at",
      )
      .or(`created_by.is.null,created_by.eq.${userId}`)
      .order("published_at", { ascending: false, nullsFirst: false })
      .limit(100),
    supabase
      .from("applications")
      .select("id,job_id,status,applied_at")
      .eq("user_id", userId),
    supabase
      .from("application_submissions")
      .select("id,job_id,resume_id,status,created_at")
      .eq("user_id", userId),
    supabase
      .from("saved_jobs")
      .select("job_id")
      .eq("user_id", userId),
  ]);
  const queryError = firstQueryError([
    settingsResult,
    basePreferencesResult,
    profileResult,
    resumeResult,
    jobsResult,
    applicationsResult,
    submissionsResult,
    savedJobsResult,
  ]);
  if (queryError) throw queryError;

  const preferences = preferencesFromRow(
    settingsResult.data,
    basePreferencesResult.data,
  );
  if (!preferences.enabled) {
    throw new AutopilotRunError("Turn on Autopilot before running it.", 409);
  }
  const profile = (profileResult.data || {}) as UnknownRow;
  const resume = resumeResult.data as UnknownRow | null;
  const parsedResume = isRecord(resume?.parsed_data) ? resume.parsed_data : null;
  const candidate = parsedResume ? candidateFrom(parsedResume, profile) : null;
  const applications = new Map(
    (applicationsResult.data || []).map((item) => [item.job_id, item as UnknownRow]),
  );
  const submissions = new Map(
    (submissionsResult.data || []).map((item) => [item.job_id, item as UnknownRow]),
  );
  const savedJobs = new Set((savedJobsResult.data || []).map((item) => item.job_id));
  const today = new Date().toISOString().slice(0, 10);
  const preparedToday = (submissionsResult.data || []).filter((item) =>
    item.created_at?.startsWith(today),
  ).length;
  if (preparedToday >= preferences.dailyLimit) {
    throw new AutopilotRunError("Today's package limit reached. Existing packages are ready to review.", 409);
  }
  const appliedToday = (applicationsResult.data || []).filter((item) =>
    item.applied_at?.startsWith(today),
  ).length;
  const matchPreferences = {
    preferred_roles: preferences.targetRoles,
    preferred_locations: preferences.locations,
    remote_only:
      preferences.workplaceModes.length === 1 &&
      preferences.workplaceModes[0] === "remote",
    employment_types: stringList(basePreferencesResult.data?.employment_types),
    minimum_salary: preferences.salaryMin,
    preferred_countries: stringList(basePreferencesResult.data?.preferred_countries),
  };
  const matchProfile = {
    target_role: text(profile.target_role) || null,
    experience_years: Number(profile.experience_years) || null,
    location: text(profile.location) || null,
    skills: parsedResume ? getResumeSkills(parsedResume) : [],
  };
  const scoredJobs = (jobsResult.data || [])
    .filter((job) => !job.expires_at || Date.parse(job.expires_at) > Date.now())
    .filter((job) => !retryAction?.job_id || job.id === retryAction.job_id)
    .filter((job) => retryAction || shouldPrepare(submissions.get(job.id)?.status))
    .map((job) => ({
      ...job,
      matchScore: calculateMatchScore(job as MatchJob, matchProfile, matchPreferences).score,
    }))
    .sort((left, right) => right.matchScore - left.matchScore)
    .slice(0, 25);

  if (retryAction && !scoredJobs.length) {
    await updateAction(supabase, userId, retryId, {
      status: "failed",
      reason: "The related job is no longer available.",
      error_message: "Job not found.",
      completed_at: new Date().toISOString(),
    });
    throw new AutopilotRunError("The related job is no longer available.", 409);
  }

  if (retryAction) {
    await updateAction(supabase, userId, retryId, {
      status: "running",
      reason: "Retrying the failed automation.",
      error_message: null,
      completed_at: null,
      retry_count: Number(retryAction.retry_count) + 1,
    });
  }

  const runContext: RunContext = {
    supabase,
    userId,
    preferences,
    profile,
    resume,
    parsedResume,
    candidate,
    applications,
    submissions,
    savedJobs,
    appliedToday,
  };
  const actions = [];

  for (const job of scoredJobs) {
    // Include packages persisted before a later step failed, so failures cannot bypass the cap.
    if ([...submissions.values()].filter((item) => text(item.created_at).startsWith(today)).length >= preferences.dailyLimit) break;
    const jobId = text(job.id);
    const application = applications.get(jobId);
    const submission = submissions.get(jobId);
    const alreadySubmitted =
      submittedApplicationStatuses.has(text(application?.status)) ||
      text(submission?.status) === "submitted";
    const decision = evaluateAutoApply(
      {
        company: text(job.company_name),
        matchScore: job.matchScore,
        applicationUrl: text(job.application_url) || null,
        salaryMin: typeof job.salary_min === "number" ? job.salary_min : null,
        salaryMax: typeof job.salary_max === "number" ? job.salary_max : null,
        alreadySubmitted,
        profileComplete: Boolean(
          candidate && candidate.name !== "Candidate" && candidate.targetRole,
        ),
        requiredAnswersKnown: Boolean(
          preferences.workAuthorization && preferences.noticePeriod,
        ),
        locationMatches: locationMatches(preferences, job),
        workplaceMatches: workplaceMatches(preferences, job),
        termsAllowAutomation: true,
        requiresManualStep: false,
        submitIntegration: false,
        appliedToday: runContext.appliedToday,
      },
      preferences,
    );
    const actionType =
      decision.state === "eligible_assisted"
        ? "prepare_assisted_application"
        : "evaluate_job";
    const terminalStatus =
      decision.state === "skipped"
        ? "skipped"
        : decision.state === "needs_review"
          ? "needs_user_confirmation"
          : null;
    let actionId = retryAction ? text(retryAction.id) : "";

    if (actionId && terminalStatus) {
      actions.push(await updateAction(supabase, userId, actionId, {
        action_type: actionType,
        status: terminalStatus,
        reason: decision.reason,
        error_message: null,
        completed_at: new Date().toISOString(),
      }));
      continue;
    }

    if (!actionId) {
      const { data: action, error } = await supabase
        .from("automation_actions")
        .insert({
          user_id: userId,
          action_type: actionType,
          job_id: jobId,
          resume_id: text(resume?.id) || null,
          application_id: text(application?.id) || null,
          status: terminalStatus || "running",
          reason: terminalStatus ? decision.reason : "Preparing a grounded application package.",
          proof_url: text(job.application_url) || null,
          completed_at: terminalStatus ? new Date().toISOString() : null,
        })
        .select("id,status,reason")
        .single();
      if (error) throw error;
      actionId = action.id;
      if (terminalStatus) {
        actions.push(action);
        continue;
      }
    }

    try {
      const prepared = await prepareAssistedApplication(runContext, job, actionId);
      const completed = await updateAction(supabase, userId, actionId, {
        action_type: actionType,
        status: "completed",
        reason: decision.reason,
        error_message: null,
        resume_id: prepared.resumeId,
        application_id: prepared.applicationId,
        proof_url: text(job.application_url) || null,
        completed_at: new Date().toISOString(),
      });
      actions.push(completed);
    } catch (error) {
      console.error("AUTOPILOT JOB ERROR:", {
        jobId,
        errorType: error instanceof Error ? error.name : "UnknownError",
      });
      const failed = await updateAction(supabase, userId, actionId, {
        action_type: actionType,
        status: "failed",
        reason: "A recoverable automation step failed.",
        error_message: "The application package could not be prepared. Retry the action.",
        completed_at: new Date().toISOString(),
      });
      actions.push(failed);
    }
  }

  return { processed: actions.length, actions };
}

export async function runAutopilot(
  supabase: ServerSupabaseClient,
  userId: string,
  retryId = "",
  scheduled = false,
) {
  // Recover locks left behind by a terminated function (max duration is 5 minutes).
  const { error: recoveryError } = await supabase.from("automation_actions")
    .update({ status: "failed", reason: "Previous run timed out; safe to retry.", completed_at: new Date().toISOString() })
    .eq("user_id", userId).in("action_type", ["autopilot_run", "scheduled_autopilot_run"])
    .eq("status", "running").lt("created_at", new Date(Date.now() - 10 * 60_000).toISOString());
  if (recoveryError) throw recoveryError;

  const { data: lock, error } = await supabase.from("automation_actions").insert({
    user_id: userId,
    action_type: scheduled ? "scheduled_autopilot_run" : "autopilot_run",
    status: "running",
    reason: scheduled ? "Daily free background run started." : "Manual run started.",
  }).select("id").single();
  if (error?.code === "23505") throw new AutopilotRunError("Autopilot is already running. Try again shortly.", 409);
  if (error) throw error;

  try {
    await consumeAllowance(userId, "autopilot");
    const result = await executeAutopilot(supabase, userId, retryId);
    await updateAction(supabase, userId, lock.id, {
      status: "completed", reason: `Evaluated ${result.processed} jobs; no automatic submission.`, completed_at: new Date().toISOString(),
    });
    return result;
  } catch (runError) {
    await updateAction(supabase, userId, lock.id, {
      status: "failed", reason: "Run stopped safely. Review settings or retry.", completed_at: new Date().toISOString(),
    });
    if (runError instanceof AllowanceError) throw new AutopilotRunError(runError.message, runError.status);
    throw runError;
  }
}
