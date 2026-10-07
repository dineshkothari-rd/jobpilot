import { brandingInput } from "@/lib/recruiter/communications";
import {
  json,
  mutationError,
  recruiterContext,
  requestBody,
} from "@/lib/recruiter/server";
export async function GET() {
  try {
    const c = await recruiterContext();
    if (c.response) return c.response;
    const company = await c.admin.rpc("hiring_company", { p_user: c.user.id });
    if (company.error) return mutationError(company.error);
    const r = await c.admin
      .from("employer_branding")
      .select(
        "tagline,about,culture,perks,tech_stack,leadership,banner_style,published,version",
      )
      .eq("user_id", c.user.id)
      .eq("company_id", company.data)
      .maybeSingle();
    return r.error
      ? json({ error: "Unable to load branding." }, 503)
      : json({
          branding: r.data || {
            tagline: "",
            about: "",
            culture: "",
            perks: [],
            tech_stack: [],
            leadership: [],
            banner_style: "blue",
            published: false,
            version: 0,
          },
        });
  } catch {
    return json({ error: "Unable to load branding." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const c = await recruiterContext(request);
    if (c.response) return c.response;
    let fields;
    try {
      fields = brandingInput(await requestBody(request));
    } catch (cause) {
      return json({ error: (cause as Error).message }, 400);
    }
    const r = await c.admin.rpc("save_employer_branding", {
      p_user: c.user.id,
      ...fields,
    });
    return r.error ? mutationError(r.error) : json({ saved: true });
  } catch {
    return json({ error: "Unable to save branding. Your draft is kept." }, 503);
  }
}
