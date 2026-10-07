import { monitoredCron } from "@/lib/operations/cron";
import "server-only";

import { createClient } from "@supabase/supabase-js";
import { authorizedCron, backgroundConfigured } from "@/lib/autopilot/schedule";
import { AutopilotRunError, runAutopilot } from "@/lib/autopilot/service";
import { syncJobs } from "@/lib/jobs/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

async function run(request: Request) {
  if (!authorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  if (!backgroundConfigured()) {
    return Response.json({ error: "Background Autopilot server setup is incomplete." }, { status: 503 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(15_000) }) },
  });
  const today = new Date().toISOString().slice(0, 10);
  const deadline = Date.now() + 240_000;
  let completed = 0;
  let skipped = 0;
  let failed = 0;

  try {
    for (let offset = 0; ; offset += 100) {
      const { data: users, error } = await supabase.from("autopilot_preferences")
        .select("user_id,target_roles").eq("enabled", true).order("user_id").range(offset, offset + 99);
      if (error) throw error;
      for (const user of users || []) {
        // ponytail: one bounded daily worker; use resumable batches if user volume outgrows 4 minutes.
        if (Date.now() >= deadline) return Response.json({ completed, skipped, failed, incomplete: true, error: "Daily worker time budget reached." }, { status: 503 });
        try {
          const { data: existing, error: historyError } = await supabase.from("automation_actions")
            .select("id").eq("user_id", user.user_id).eq("action_type", "scheduled_autopilot_run")
            .eq("status", "completed").gte("created_at", today).limit(1);
          if (historyError) throw historyError;
          if (existing?.length) { skipped += 1; continue; }
          // Free job feed outage must not prevent safe evaluation of existing jobs.
          try { await syncJobs(supabase, user.user_id, user.target_roles); }
          catch { console.warn("AUTOPILOT: public job feed refresh unavailable."); }
          await runAutopilot(supabase, user.user_id, "", true);
          completed += 1;
        } catch (error) {
          if (error instanceof AutopilotRunError && (error.status === 409 || error.status === 429)) skipped += 1;
          else { failed += 1; console.error("AUTOPILOT: background user run failed safely."); }
        }
      }
      if (!users || users.length < 100) break;
    }
    return Response.json({ completed, skipped, failed }, { status: failed ? 503 : 200 });
  } catch {
    return Response.json({ error: "Daily Autopilot failed safely.", completed, skipped, failed }, { status: 503 });
  }
}

export async function GET(request: Request) {
  return monitoredCron(request, "autopilot", () => run(request));
}
