import { createClient } from "@/lib/supabase/server";
import { json } from "@/lib/recruiter/server";
export async function GET() {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to view delivery history." }, 401);
    const since = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
    const tables = ["reminder_deliveries", "job_alert_deliveries"] as const;
    const results = await Promise.all(tables.map(table => client.from(table)
      .select("id,run_day,channel,status,attempts,sent_at,lease_until")
      .eq("user_id", user.id).gte("run_day", since).order("run_day", { ascending: false }).order("id").limit(26)));
    if (results.some(result => result.error)) return json({ error: "Delivery history is unavailable. Please try again later." }, 503);
    const rows = results.flatMap((result, index) => (result.data || []).map(row => ({ id: row.id, run_day: row.run_day, channel: row.channel, status: row.status, attempts: row.attempts, sent_at: row.sent_at, lease_until: row.lease_until, kind: index === 0 ? "reminder" : "job_alert" })))
      .sort((a, b) => b.run_day.localeCompare(a.run_day) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id));
    return json({ history: rows.slice(0, 25), more: rows.length > 25, checked_at: new Date().toISOString() });
  } catch { return json({ error: "Unable to load delivery history." }, 503); }
}
