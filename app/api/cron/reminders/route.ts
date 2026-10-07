import { monitoredCron } from "@/lib/operations/cron";
import "server-only";
import { createClient } from "@supabase/supabase-js";
import { claimDelivery, sendEmail, sendPush } from "@/lib/notifications/delivery";
import { authorizedCron } from "@/lib/autopilot/schedule";
import { activeApplication, followUpDue, interviewDue, reminderConfiguration } from "@/lib/notifications/reminders";
export const runtime = "nodejs";
export const maxDuration = 300;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function run(request: Request) {
  if (!authorizedCron(request.headers.get("authorization"), process.env.CRON_SECRET)) return json({ error: "Unauthorized" }, 401);
  const config = reminderConfiguration();
  if (!config.email && !config.push) return json({ skipped: "Reminder providers are not configured." });
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const now = new Date(); const day = now.toISOString().slice(0, 10); const deadline = Date.now() + 240_000;
  let sent = 0; let failed = 0;
  try {
    // ponytail: bounded daily scan; use a resumable queue if the worker reaches its four-minute budget.
    for (let offset = 0; ; offset += 100) {
      const { data: preferences, error } = await admin.from("notification_preferences").select("user_id,email_enabled,push_enabled,timezone").or("email_enabled.eq.true,push_enabled.eq.true").order("user_id").range(offset, offset + 99);
      if (error) throw Error("Preferences unavailable");
      for (const prefs of preferences || []) {
        if (Date.now() >= deadline) return json({ sent, failed, incomplete: true }, 503);
        try {
          const { data: deletion, error: deletionError } = await admin.from("account_deletion_requests").select("user_id").eq("user_id", prefs.user_id).maybeSingle();
          if (deletionError) throw Error("Deletion check failed");
          if (deletion) continue;
          const [applications, interviews] = await Promise.all([
            admin.from("applications").select("id,status,follow_up_at").eq("user_id", prefs.user_id).not("follow_up_at", "is", null).gte("follow_up_at", new Date(now.getTime() - 2 * 86400000).toISOString()).lte("follow_up_at", new Date(now.getTime() + 3 * 86400000).toISOString()).limit(1_000),
            admin.from("application_interviews").select("starts_at,applications!inner(status)").eq("user_id", prefs.user_id).eq("status", "scheduled").gte("starts_at", now.toISOString()).lte("starts_at", new Date(now.getTime() + 26 * 3600000).toISOString()).limit(1_000),
          ]);
          if (applications.error || interviews.error) throw Error("Schedule unavailable");
          const followUps = (applications.data || []).some(app => activeApplication(app.status) && followUpDue(app.follow_up_at, now, prefs.timezone));
          const upcoming = (interviews.data || []).some(interview => {
            const application = Array.isArray(interview.applications) ? interview.applications[0] : interview.applications;
            return application && activeApplication(application.status) && interviewDue(interview.starts_at, now);
          });
          if (!followUps && !upcoming) continue;
          if (prefs.email_enabled && config.email) {
            try {
              const { data: { user }, error: userError } = await admin.auth.admin.getUserById(prefs.user_id);
              if (userError) throw Error("Account unavailable");
              if (user?.email && user.email_confirmed_at) {
                if (await claimDelivery(admin, "reminder", prefs.user_id, day, "email", "email", async () => {
                  await sendEmail(user.email!, "Your JobPilot interview and follow-up reminder", `You have an upcoming interview or a follow-up due today or tomorrow.\n\nReview your schedule: ${config.siteUrl}/applications\n\nDaily reminders are a heads-up, not an exact-time alarm. Manage or turn off reminders: ${config.siteUrl}/profile`, `reminder/${prefs.user_id}/${day}`);
                })) sent++;
              }
            } catch { failed++; }
          }
          if (prefs.push_enabled && config.push) {
            const { data: devices, error: deviceError } = await admin.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("user_id", prefs.user_id);
            if (deviceError) throw Error("Devices unavailable");
            for (const device of devices || []) {
              if (Date.now() >= deadline) return json({ sent, failed, incomplete: true }, 503);
              try {
                if (await claimDelivery(admin, "reminder", prefs.user_id, day, "push", device.id, async () => {
                  await sendPush(admin, prefs.user_id, device, "reminder", day);
                })) sent++;
              } catch { failed++; }
            }
          }
        } catch { failed++; }
      }
      if (!preferences || preferences.length < 100) break;
    }
    return json({ sent, failed }, failed ? 503 : 200);
  } catch { return json({ error: "Reminder run failed.", sent, failed }, 503); }
}

export async function GET(request: Request) {
  return monitoredCron(request, "reminders", () => run(request));
}
