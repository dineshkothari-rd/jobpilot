import { syncJobs } from "@/lib/jobs/sync";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "You must be logged in." }, { status: 401 });
    if (!process.env.SUPABASE_SECRET_KEY) return Response.json({ error: "Job refresh is temporarily unavailable. Your existing opportunities still work." }, { status: 503 });
    const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    return Response.json(await syncJobs(admin, user.id));
  } catch {
    return Response.json({ error: "Failed to sync jobs. Check your profile and try again." }, { status: 500 });
  }
}
