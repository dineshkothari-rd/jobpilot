import { createClient } from "@/lib/supabase/server";
import { calculateSalaryBenchmark, filterSalaryJobs, ROLE_LABELS, type RoleCategory, type RawSalaryJob } from "@/lib/salaries/benchmarking";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const role = searchParams.get("role") || "fullstack";
  const currency = (searchParams.get("currency") || "INR").toUpperCase();
  const location = (searchParams.get("location") || "all").trim().toLowerCase();
  if (!Object.hasOwn(ROLE_LABELS, role) || !["INR", "USD"].includes(currency) || location.length > 100) {
    return Response.json({ error: "Invalid salary filters." }, { status: 400 });
  }

  try {
    const supabase = await createClient();
    const jobs: RawSalaryJob[] = [];
    const now = new Date().toISOString();
    // Read every page so a server row limit cannot silently skew the sample.
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from("jobs")
        .select("id, title, company_name, location, seniority, salary_min, salary_max, salary_currency, source, source_url, published_at, application_url")
        .is("created_by", null)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .or("salary_min.not.is.null,salary_max.not.is.null")
        .in("salary_currency", currency === "INR" ? ["INR", "₹"] : ["USD", "$"])
        .order("id")
        .range(offset, offset + 499);
      if (error) throw error;
      jobs.push(...(data || []));
      if (!data || data.length < 500) break;
    }
    const matchingJobs = filterSalaryJobs(jobs, role as RoleCategory, currency, location);
    return Response.json({
      benchmark: calculateSalaryBenchmark(matchingJobs, role as RoleCategory, currency),
      matchingJobs: matchingJobs.slice(0, 12),
    });
  } catch (err) {
    console.error("GET SALARIES ERROR:", err);
    return Response.json({ error: "Unable to load salary benchmarks." }, { status: 500 });
  }
}
