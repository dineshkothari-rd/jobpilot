import { json, recruiterContext } from "@/lib/recruiter/server";
import { uuid } from "@/lib/recruiter/validation";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const c = await recruiterContext();
    if (c.response) return c.response;
    let id;
    try {
      id = uuid((await params).id);
    } catch {
      return json({ error: "Invalid company." }, 400);
    }
    const r = await c.admin.rpc("get_employer_branding", { p_company: id });
    if (r.error) return json({ error: "Unable to load employer page." }, 503);
    if (!r.data) return json({ error: "Employer page is not published." }, 404);
    const jobs = await c.admin
      .from("moderated_jobs")
      .select("id,title,location")
      .eq("recruiter_company_id", id)
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .order("published_at", { ascending: false })
      .limit(100);
    return jobs.error
      ? json({ error: "Unable to load employer jobs." }, 503)
      : json({ company: r.data, jobs: jobs.data || [] });
  } catch {
    return json({ error: "Unable to load employer page." }, 503);
  }
}
