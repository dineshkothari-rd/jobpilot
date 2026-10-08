import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 300;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const personalTables = [
  "job_preferences", "resumes", "saved_jobs", "applications", "application_events",
  "autopilot_preferences", "automation_actions", "application_submissions",
  "skillpath_enrollments", "skillpath_attempts", "skillpath_credentials",
  "interview_practice_sessions", "application_interviews", "my_day_preferences",
  "learning_goals", "portfolio_evidence", "saved_searches", "company_follows",
  "company_reviews", "job_reports", "support_tickets", "notification_preferences", "push_subscriptions", "reminder_deliveries",
  "calendar_connections", "calendar_event_links", "job_alert_preferences", "job_alert_runs", "job_alert_deliveries",
  "recruiter_companies", "company_verification_requests", "candidate_visibility", "employer_applications", "employer_application_events", "recruiter_shortlists", "hiring_notifications", "employer_branding", "launch_usage", "launch_plan_assignments", "billing_intents", "billing_payments", "billing_entitlements", "posting_credit_balance", "posting_credit_spends",
];

async function readRows(client: SupabaseClient, table: string, field: string, userId: string, unavailable: string[]) {
  const rows: Record<string, unknown>[] = [];
  const primaryKey = ["billing_entitlements", "posting_credit_balance"].includes(table) ? "mode" : table === "posting_credit_spends" ? "job_id" : table === "launch_usage" ? "usage_day" : table === "employer_branding" ? "company_id" : table === "skillpath_enrollments" ? "path_id" : ["autopilot_preferences", "my_day_preferences", "learning_goals", "notification_preferences", "job_alert_preferences", "candidate_visibility", "launch_plan_assignments"].includes(table) ? "user_id" : "id";
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await client.from(table).select<string, Record<string, unknown>>(table === "billing_intents" ? "id,user_id,product_id,mode,amount_minor,provider_resource,status,created_at,updated_at" : table === "calendar_connections" ? "id,user_id,provider,created_at" : "*").eq(field, userId).order(primaryKey).range(offset, offset + 499);
    // Newly added tables may be absent during rollout; mark them explicitly in the archive.
    if (offset === 0 && ["support_tickets", "notification_preferences", "push_subscriptions", "reminder_deliveries", "calendar_connections", "calendar_event_links", "job_alert_preferences", "job_alert_runs", "job_alert_deliveries", "recruiter_companies", "company_verification_requests", "candidate_visibility", "employer_applications", "employer_application_events", "recruiter_shortlists", "hiring_notifications", "employer_branding", "launch_usage", "launch_plan_assignments", "billing_intents", "billing_payments", "billing_entitlements", "posting_credit_balance", "posting_credit_spends"].includes(table) && ["42P01", "PGRST205"].includes(error?.code || "")) { unavailable.push(table); return rows; }
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < 500) return rows;
  }
}

export async function GET() {
  try {
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to export your data." }, 401);
    const unavailable: string[] = [];
    const results = await Promise.all([
      readRows(client, "profiles", "id", user.id, unavailable),
      ...personalTables.map((table) => readRows(client, table, "user_id", user.id, unavailable)),
      readRows(client, "jobs", "created_by", user.id, unavailable),
    ]);
    const tables = Object.fromEntries(["profiles", ...personalTables, "user_added_jobs"].map((table, index) => [table, results[index]]));
    const companies = tables.recruiter_companies;
    if (companies?.length) {
      if (!process.env.SUPABASE_SECRET_KEY || companies.some(company => company.user_id !== user.id)) throw Error("Recruiter export unavailable");
      const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      tables.recruiter_postings = await readRows(admin, "jobs", "recruiter_company_id", String(companies[0].id), unavailable);
    } else tables.recruiter_postings = [];
    if(!process.env.SUPABASE_SECRET_KEY)throw Error('Hiring export unavailable');
    const hiringAdmin=createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    for(const kind of ['threads','messages','invitations']){
      const rows:Record<string,unknown>[]=[];
      for(let offset=0;;offset+=500){const result=await hiringAdmin.rpc('get_hiring_export_rows',{p_user:user.id,p_kind:kind,p_offset:offset});if(offset===0&&['42P01','PGRST202'].includes(result.error?.code||'')){unavailable.push('hiring_'+kind);break;}if(result.error)throw result.error;rows.push(...(result.data||[]));if((result.data?.length||0)<500)break;}
      tables['hiring_'+kind]=rows;
    }
    return Response.json({ format_version: 1, exported_at: new Date().toISOString(),
      account: { id: user.id, email: user.email, created_at: user.created_at, user_metadata: user.user_metadata },
      tables, unavailable_sections: unavailable, calendar_credentials: "OAuth access/refresh tokens and internal sync leases are excluded; connection metadata and event links are included.", resume_files: "Original PDF files are not included; resume text, parsed data and file metadata are included.",
    }, { headers: { "Cache-Control": "private, no-store", "Content-Disposition": 'attachment; filename="jobpilot-data.json"', ...(unavailable.length ? { "X-JobPilot-Export-Warning": "Export downloaded. Some recently added sections were unavailable and are marked in the archive." } : {}) } });
  } catch {
    return json({ error: "Your complete data export could not be generated. No partial archive was returned. Please try again." }, 503);
  }
}

async function removeResumeFiles(admin: SupabaseClient, prefix: string) {
  // Re-list from zero after removal so pagination cannot skip shifted entries.
  const bucket = admin.storage.from("resumes");
  const folders = [prefix];
  while (folders.length) {
    const folder = folders.pop()!;
    const { data, error } = await bucket.list(folder, { limit: 100, sortBy: { column: "name", order: "asc" } });
    if (error) throw error;
    if ((data || []).some((entry) => !entry.name || entry.name === "." || entry.name === ".." || /[\\/]/.test(entry.name))) throw new Error("Invalid storage path");
    const files = (data || []).filter((entry) => entry.id).map((entry) => `${folder}/${entry.name}`);
    const children = (data || []).filter((entry) => !entry.id).map((entry) => `${folder}/${entry.name}`);
    if (files.length) {
      const { error: removeError } = await bucket.remove(files);
      if (removeError) throw removeError;
    }
    folders.push(...children);
    if ((data?.length || 0) === 100) folders.unshift(folder);
  }
}

export async function DELETE(request: Request) {
  let cleanupStarted = false;
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin || request.headers.get("sec-fetch-site") === "cross-site") {
      return json({ error: "This request must come from JobPilot." }, 403);
    }
    if (Number(request.headers.get("content-length") || 0) > 1024) return json({ error: "Request too large." }, 413);
    const raw = await request.text();
    if (raw.length > 1024) return json({ error: "Request too large." }, 413);
    let body;
    try { body = JSON.parse(raw); } catch { return json({ error: "Invalid confirmation." }, 400); }
    if (body?.confirmation !== "DELETE") return json({ error: 'Type "DELETE" to confirm permanent account deletion.' }, 400);
    const client = await createClient();
    const { data: { user }, error } = await client.auth.getUser();
    if (error || !user) return json({ error: "Sign in to delete your account." }, 401);
    if (!process.env.SUPABASE_SECRET_KEY) return json({ error: "Account deletion is temporarily unavailable." }, 503);
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // Never accept a target account or storage path from the request.
    const { error: freezeError } = await admin.from("account_deletion_requests").upsert({ user_id: user.id }, { onConflict: "user_id", ignoreDuplicates: true });
    if (freezeError) return json({ error: "Account deletion is temporarily unavailable. No data was removed." }, 503);
    const { data: { session }, error: sessionError } = await client.auth.getSession();
    if (sessionError || !session || session.user.id !== user.id) return json({ error: "Sign in again to complete account deletion." }, 401);
    const { error: revokeError } = await admin.auth.admin.signOut(session.access_token, "global");
    if (revokeError) return json({ error: "Unable to revoke account sessions. Sign in again and retry deletion." }, 503);
    cleanupStarted = true;
    const { error: pauseError } = await admin.from("autopilot_preferences").update({ enabled: false }).eq("user_id", user.id);
    if (pauseError) throw pauseError;
    await removeResumeFiles(admin, user.id);
    const { error: deletionError } = await admin.auth.admin.deleteUser(user.id);
    if (deletionError) throw deletionError;
    // Auth deletion cascades owned rows and invalidates future getUser checks.
    await client.auth.signOut({ scope: "local" }).catch(() => {});
    return json({ deleted: true });
  } catch {
    return json({ error: cleanupStarted
      ? "Deletion did not finish. Some resume files may already be removed and uploads are paused. Sign in again and retry deletion to finish cleanup."
      : "Account deletion could not be completed. Please try again." }, 503);
  }
}
