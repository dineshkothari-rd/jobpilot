import { syncJobs } from "@/lib/jobs/sync";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error || !user) return Response.json({ error: "You must be logged in." }, { status: 401 });
    return Response.json(await syncJobs(supabase, user.id));
  } catch {
    return Response.json({ error: "Failed to sync jobs. Check your profile and try again." }, { status: 500 });
  }
}
