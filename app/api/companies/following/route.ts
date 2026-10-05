import { createClient } from "@/lib/supabase/server";
import { computeCompanyAlerts, type FollowedCompanySummary } from "@/lib/companies/follows";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return Response.json({ error: "You must be logged in." }, { status: 401 });
    }

    const { data: follows, error: followsErr } = await supabase
      .from("company_follows")
      .select("company_slug, company_name, notify_new_openings, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (followsErr) {
      throw new Error(followsErr.message);
    }

    if (!follows || follows.length === 0) {
      return Response.json({ followedCompanies: [] });
    }

    // Fetch active jobs for all followed companies to compute fresh opening alerts
    const companyNames = Array.from(new Set(follows.map((f) => f.company_name).filter(Boolean)));
    const { data: jobs, error: jobsErr } = await supabase
      .from("jobs")
      .select("company_name, published_at")
      .eq("is_closed", false)
      .in("company_name", companyNames);

    if (jobsErr) {
      console.warn("Followed companies jobs query error:", jobsErr.message);
    }

    const jobsByCompany = new Map<string, Array<{ published_at: string | null }>>();
    for (const job of jobs || []) {
      if (!job.company_name) continue;
      const key = job.company_name.toLowerCase().trim();
      const list = jobsByCompany.get(key) || [];
      list.push(job);
      jobsByCompany.set(key, list);
    }

    const now = new Date();
    const followedCompanies: FollowedCompanySummary[] = follows.map((f) => {
      const matchingJobs = jobsByCompany.get(f.company_name.toLowerCase().trim()) || [];
      const { totalOpenings, newOpeningsLast7Days } = computeCompanyAlerts(matchingJobs, now);
      return {
        companySlug: f.company_slug,
        companyName: f.company_name,
        notifyNewOpenings: f.notify_new_openings,
        followedAt: f.created_at,
        totalOpenings,
        newOpeningsLast7Days,
      };
    });

    return Response.json({ followedCompanies });
  } catch (err) {
    console.error("GET FOLLOWED COMPANIES ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to load followed companies." },
      { status: 500 },
    );
  }
}
