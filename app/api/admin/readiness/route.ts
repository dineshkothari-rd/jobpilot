import { json, recruiterContext } from "@/lib/recruiter/server";
import { reminderConfiguration } from "@/lib/notifications/reminders";
import { calendarConfig } from "@/lib/calendars/provider";
import { workerHealth, workerNames } from "@/lib/operations/status";
export async function GET() {
  try {
    const c = await recruiterContext(undefined, true);
    if (c.response) return c.response;
    const config = reminderConfiguration();
    const rows = await Promise.all(workerNames.map(worker => c.admin.from("worker_runs")
      .select("id,state,started_at,finished_at,completed,failed,skipped")
      .eq("worker", worker).order("started_at", { ascending: false }).order("id").limit(20)));
    return json({
      checked_at: new Date().toISOString(),
      configuration: [
        { name: "Daily background jobs", configured: Boolean(process.env.CRON_SECRET && process.env.SUPABASE_SECRET_KEY), detail: "Daily schedule configured in the app. Run history below confirms whether jobs actually ran." },
        { name: "Email alerts and reminders", configured: config.email, detail: "Requires an approved sender/provider configuration. Configured does not mean inbox delivery was verified." },
        { name: "Browser push", configured: config.push, detail: "Requires VAPID setup plus permission and device connection by each candidate." },
        { name: "Google Calendar", configured: calendarConfig("google").ready, detail: "Requires calendar OAuth setup and a real connect/send/import test." },
        { name: "Outlook Calendar", configured: calendarConfig("outlook").ready, detail: "Requires calendar OAuth setup and a real connect/send/import test." },
      ],
      workers: workerNames.map((worker, index) => ({ worker, health: rows[index].error ? "unavailable" : workerHealth(rows[index].data?.[0]), runs: rows[index].error ? [] : rows[index].data || [] })),
      pending_release_checks: ["Real candidate/recruiter/admin pilot", "Verified support inbox and legal review", "Production backup, off-device copy and isolated restore", "Accessibility acceptance", "Usage review and hosting approval for commercial operation"],
    });
  } catch { return json({ error: "Unable to load launch readiness." }, 503); }
}
