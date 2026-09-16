import "server-only";
import { backgroundConfigured } from "./schedule";

import { analyzeResume } from "../resume/ats";
import type { ParsedResume } from "../resume/parser";
import type { ServerSupabaseClient } from "../supabase/server";
import type { AutopilotPreferences } from "./eligibility";
import {
  preferencesFromRow,
  preferencesToRow,
} from "./preferences";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

function resumeHealth(parsed: unknown) {
  if (!isRecord(parsed)) return 0;

  try {
    return analyzeResume(parsed as ParsedResume).score;
  } catch {
    return 0;
  }
}

export async function getAutopilotDashboard(
  supabase: ServerSupabaseClient,
  userId: string,
) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const [
    settings,
    jobPreferences,
    profile,
    resume,
    actions,
    submissions,
    submittedToday,
    preparedToday,
    lastRun,
    followUps,
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
      .select("full_name,target_role,experience_years,location")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("resumes")
      .select("id,file_name,parsed_data,is_primary")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("automation_actions")
      .select(
        "id,action_type,status,reason,error_message,proof_url,retry_count,created_at,completed_at,job_id,jobs(title,company_name,application_url)",
      )
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("application_submissions")
      .select(
        "id,job_id,resume_id,mode,status,cover_note,application_answers,checklist,application_url,proof_url,created_at,updated_at,jobs(title,company_name)",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(30),
    supabase
      .from("application_submissions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "submitted")
      .gte("submitted_at", today.toISOString()),
    supabase.from("application_submissions").select("id", { count: "exact", head: true })
      .eq("user_id", userId).gte("created_at", today.toISOString()),
    supabase.from("automation_actions").select("created_at,status")
      .eq("user_id", userId).in("action_type", ["autopilot_run", "scheduled_autopilot_run"])
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase
      .from("applications")
      .select("id,status,follow_up_at,updated_at")
      .eq("user_id", userId)
      .not("follow_up_at", "is", null)
      .gte("follow_up_at", new Date().toISOString())
      .order("follow_up_at", { ascending: true })
      .limit(5),
  ]);

  const queryError = [
    settings,
    jobPreferences,
    profile,
    resume,
    actions,
    submissions,
    submittedToday,
    preparedToday,
    lastRun,
    followUps,
  ].find((result) => result.error)?.error;
  if (queryError) throw queryError;

  const profileFields = profile.data
    ? [
        profile.data.full_name,
        profile.data.target_role,
        profile.data.location,
        profile.data.experience_years,
      ]
    : [];

  return {
    preferences: preferencesFromRow(settings.data, jobPreferences.data),
    setup: {
      profileCompleteness: Math.round(
        (profileFields.filter((value) => value !== null && value !== "").length /
          4) *
          100,
      ),
      resumeHealth: resumeHealth(resume.data?.parsed_data),
      hasResume: Boolean(resume.data),
    },
    usage: { submittedToday: submittedToday.count || 0, preparedToday: preparedToday.count || 0 },
    background: {
      configured: backgroundConfigured(),
      lastRunAt: lastRun.data?.created_at || null,
      lastRunStatus: lastRun.data?.status || null,
    },
    actions: actions.data || [],
    submissions: submissions.data || [],
    upcomingFollowUps: followUps.data || [],
  };
}

export async function saveAutopilotPreferences(
  supabase: ServerSupabaseClient,
  userId: string,
  preferences: AutopilotPreferences,
) {
  const { data, error } = await supabase
    .from("autopilot_preferences")
    .upsert(preferencesToRow(preferences, userId), { onConflict: "user_id" })
    .select("*")
    .single();

  if (error) throw error;
  return preferencesFromRow(data);
}
