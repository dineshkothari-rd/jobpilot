import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json(
        {
          error: "You must be logged in.",
        },
        { status: 401 },
      );
    }

    const body: unknown = await request.json().catch(() => null);

    if (!body || typeof body !== "object") {
      return Response.json({ error: "A valid JSON body is required." }, { status: 400 });
    }

    const jobId =
      typeof (body as { jobId?: unknown }).jobId === "string"
        ? (body as { jobId: string }).jobId.trim()
        : "";

    const action =
      (body as { action?: unknown }).action;

    if (!jobId || jobId.length > 200) {
      return Response.json(
        {
          error: "Job ID is required.",
        },
        { status: 400 },
      );
    }

    if (action !== "save" && action !== "remove") {
      return Response.json({ error: "Action must be save or remove." }, { status: 400 });
    }

    const { data: job, error: jobError } = await supabase
      .from("jobs")
      .select("id")
      .eq("id", jobId)
      .maybeSingle();

    if (jobError) throw new Error(jobError.message);
    if (!job) return Response.json({ error: "Job not found." }, { status: 404 });

    if (action === "remove") {
      const { error } = await supabase
        .from("saved_jobs")
        .delete()
        .eq("user_id", user.id)
        .eq("job_id", jobId);

      if (error) {
        throw new Error(
          `Failed to remove saved job: ${error.message}`,
        );
      }

      return Response.json({
        success: true,
        saved: false,
      });
    }

    const { error } = await supabase
      .from("saved_jobs")
      .upsert(
        {
          user_id: user.id,
          job_id: jobId,
        },
        {
          onConflict: "user_id,job_id",
          ignoreDuplicates: true,
        },
      );

    if (error) {
      throw new Error(
        `Failed to save job: ${error.message}`,
      );
    }

    return Response.json({
      success: true,
      saved: true,
    });
  } catch (error) {
    console.error(
      "SAVE JOB ERROR:",
      error,
    );

    return Response.json(
      {
        error: "Failed to update saved job.",
      },
      { status: 500 },
    );
  }
}
