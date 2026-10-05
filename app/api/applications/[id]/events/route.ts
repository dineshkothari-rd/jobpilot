import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return Response.json({ error: "You must be logged in." }, { status: 401 });
    const { id } = await context.params;
    const before = new URL(request.url).searchParams.get("before");
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) ||
      (before !== null && (!/^[1-9]\d{0,18}$/.test(before) || BigInt(before) > BigInt("9223372036854775807")))) {
      return Response.json({ error: "Invalid history request." }, { status: 400 });
    }
    const { data: application, error: applicationError } = await supabase.from("applications")
      .select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
    if (applicationError) return Response.json({ error: "Unable to load application." }, { status: 500 });
    if (!application) return Response.json({ error: "Application not found." }, { status: 404 });
    let query = supabase.from("application_events").select("id,kind,changes,created_at,actor_id")
      .eq("application_id", id).eq("user_id", user.id).order("id", { ascending: false }).limit(51);
    if (before) query = query.lt("id", before);
    const { data, error } = await query;
    if (error) return Response.json({ error: "Activity history is temporarily unavailable." }, { status: 503 });
    const events = (data || []).slice(0, 50).map((event) => ({ ...event,
      actor: event.kind === "snapshot" ? "Recorded state" : event.actor_id === user.id ? "You" : event.actor_id ? "Another account" : "System",
      actor_id: undefined,
    }));
    return Response.json({ events, hasMore: (data?.length || 0) > 50 }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Unable to load activity history." }, { status: 500 });
  }
}
