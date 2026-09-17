import { createClient } from "@/lib/supabase/server";
import { parseApplicationFacts } from "@/lib/applications/facts";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return Response.json({ error: "You must be logged in." }, { status: 401 });

  let facts;
  let previousFacts;
  try {
    const body = await request.json();
    if (body?.confirmed !== true) throw new Error("Confirm that these are your actual facts before saving.");
    facts = parseApplicationFacts(body.facts);
    previousFacts = parseApplicationFacts(body.previousFacts);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Invalid application facts." }, { status: 400 });
  }

  try {
    const { data, error } = await supabase.from("profiles")
      .update({ application_facts: facts }).eq("id", user.id)
      .eq("application_facts", JSON.stringify(previousFacts))
      .select("application_facts").maybeSingle();
    if (error?.code === "42703" || error?.code === "PGRST204") {
      return Response.json({ error: "Saved answers setup is pending administrator approval. Normal applying still works." }, { status: 503 });
    }
    if (error) throw error;
    if (!data) return Response.json({ error: "Your saved answers changed in another tab, or Profile is incomplete. Refresh before saving; keep a copy of your edits." }, { status: 409 });
    return Response.json({ success: true, facts: data.application_facts }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Could not save answers. Your edits are still available; retry." }, { status: 500 });
  }
}
