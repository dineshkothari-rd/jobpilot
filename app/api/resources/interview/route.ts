import { searchLearningResources } from "@/lib/resources/resource-provider-factory";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 15;

const strings = (value: unknown) =>
  Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
    : [];

const text = (value: string | null, max: number) => (value || "").trim().slice(0, max);

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const jobId = text(searchParams.get("jobId"), 200);
    const topic = text(searchParams.get("topic"), 160);
    if (!jobId) {
      return Response.json({ error: "A valid jobId is required." }, { status: 400 });
    }

    const jobResult = await supabase
      .from("jobs")
      .select("id,title,skills")
      .eq("id", jobId)
      .maybeSingle();

    if (jobResult.error) throw new Error(jobResult.error.message);
    if (!jobResult.data) return Response.json({ error: "Job not found." }, { status: 404 });

    const result = await searchLearningResources({
      topic: topic || strings(jobResult.data.skills)[0] || jobResult.data.title || "interview preparation",
      jobTitle: jobResult.data.title || "",
      skills: strings(jobResult.data.skills),
    });

    return Response.json({ success: true, ...result });
  } catch (error) {
    console.error("INTERVIEW RESOURCE ERROR:", error instanceof Error ? error.message : "Unknown error");
    return Response.json({ error: "Failed to load interview resources." }, { status: 500 });
  }
}
