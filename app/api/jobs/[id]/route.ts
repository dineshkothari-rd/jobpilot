import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json(
        { error: "Unauthorized." },
        { status: 401 },
      );
    }

    const { id } = await context.params;

    if (!id.trim() || id.length > 200) {
      return Response.json(
        { error: "Job ID is required." },
        { status: 400 },
      );
    }

    const { data: job, error } =
      await supabase
        .from("jobs")
        .select(
          `
            id,
            external_id,
            title,
            company_name,
            description,
            location,
            country,
            employment_type,
            seniority,
            salary_min,
            salary_max,
            salary_currency,
            application_url,
            source_url,
            source,
            published_at,
            expires_at,
            created_by,
            version,
            skills,
            timezone
          `,
        )
        .eq("id", id)
        .single();

    if (error || !job) {
      return Response.json(
        { error: "Job not found." },
        { status: 404 },
      );
    }

    let directFields = {};
    if (job.source === "jobpilot") {
      const { data, error } = await supabase.from("jobs").select("equity_min,equity_max").eq("id", id).single();
      if (error) throw new Error("Direct job details unavailable.");
      directFields = data;
    }

    const { data: savedJob, error: savedError } =
      await supabase
        .from("saved_jobs")
        .select("job_id")
        .eq("user_id", user.id)
        .eq("job_id", id)
        .maybeSingle();

    const { data: application, error: applicationError } =
      await supabase
        .from("applications")
        .select(
          `
            id,
            status,
            version,
            applied_at,
            follow_up_at,
            notes,
            resume_id
          `,
        )
        .eq("user_id", user.id)
        .eq("job_id", id)
        .maybeSingle();

    const contextError = savedError || applicationError;
    if (contextError) throw new Error(contextError.message);

    return Response.json({
      success: true,
      job: { ...job, ...directFields, is_user_added: job.created_by === user.id, created_by: undefined },
      saved: Boolean(savedJob),
      application: application || null,
    });
  } catch (error) {
    console.error(
      "JOB DETAIL API ERROR:",
      error,
    );

    return Response.json(
      {
        error: "Failed to load job.",
      },
      { status: 500 },
    );
  }
}
