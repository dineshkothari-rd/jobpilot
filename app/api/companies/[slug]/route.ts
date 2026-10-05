import { getCompanyBySlug } from "@/lib/companies/service";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await props.params;
    if (!slug || typeof slug !== "string") {
      return Response.json({ error: "Slug is required." }, { status: 400 });
    }

    const company = await getCompanyBySlug(slug);
    if (!company) {
      return Response.json({ error: "Company not found." }, { status: 404 });
    }

    return Response.json({ company });
  } catch (err) {
    console.error("GET COMPANY ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to load company profile." },
      { status: 500 },
    );
  }
}
