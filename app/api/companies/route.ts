import { listCompanies } from "@/lib/companies/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const companies = await listCompanies();
    return Response.json({ companies });
  } catch (err) {
    console.error("GET COMPANIES ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to list companies." },
      { status: 500 },
    );
  }
}
