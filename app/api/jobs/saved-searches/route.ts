import { createClient } from "@/lib/supabase/server";
import {
  validateSavedSearchCriteria,
  validateSavedSearchName,
} from "@/lib/jobs/saved-searches";

export const runtime = "nodejs";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "You must be logged in." }, { status: 401 });
    }

    const { data: savedSearches, error: queryError } = await supabase
      .from("saved_searches")
      .select("id, user_id, name, criteria, created_at, updated_at")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });

    if (queryError) {
      throw new Error(queryError.message);
    }

    return Response.json({ saved_searches: savedSearches || [] });
  } catch (err) {
    console.error("GET SAVED SEARCHES ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to load saved searches." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "You must be logged in." }, { status: 401 });
    }

    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return Response.json({ error: "A valid JSON body is required." }, { status: 400 });
    }

    const { name: rawName, criteria: rawCriteria, id: rawId } = body as {
      name?: unknown;
      criteria?: unknown;
      id?: unknown;
    };

    const nameValidation = validateSavedSearchName(rawName);
    if (!nameValidation.valid) {
      return Response.json({ error: nameValidation.error }, { status: 400 });
    }

    const criteriaValidation = validateSavedSearchCriteria(rawCriteria);
    if (!criteriaValidation.valid) {
      return Response.json({ error: criteriaValidation.error }, { status: 400 });
    }

    if (typeof rawId === "string" && rawId.trim()) {
      // Update existing saved search
      const { data: updated, error: updateError } = await supabase
        .from("saved_searches")
        .update({
          name: nameValidation.sanitized,
          criteria: criteriaValidation.criteria,
          updated_at: new Date().toISOString(),
        })
        .eq("id", rawId.trim())
        .eq("user_id", user.id)
        .select("id, user_id, name, criteria, created_at, updated_at")
        .maybeSingle();

      if (updateError) throw new Error(updateError.message);
      if (!updated) {
        return Response.json({ error: "Saved search not found or unauthorized." }, { status: 404 });
      }

      return Response.json({ saved_search: updated });
    }

    // Insert new saved search
    const { data: inserted, error: insertError } = await supabase
      .from("saved_searches")
      .insert({
        user_id: user.id,
        name: nameValidation.sanitized,
        criteria: criteriaValidation.criteria,
      })
      .select("id, user_id, name, criteria, created_at, updated_at")
      .single();

    if (insertError) throw new Error(insertError.message);

    return Response.json({ saved_search: inserted }, { status: 201 });
  } catch (err) {
    console.error("POST SAVED SEARCH ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to save search." },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return Response.json({ error: "You must be logged in." }, { status: 401 });
    }

    const url = new URL(request.url);
    const id = url.searchParams.get("id");

    if (!id || typeof id !== "string") {
      return Response.json({ error: "Saved search ID is required." }, { status: 400 });
    }

    const { error: deleteError } = await supabase
      .from("saved_searches")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (deleteError) throw new Error(deleteError.message);

    return Response.json({ success: true, deleted_id: id });
  } catch (err) {
    console.error("DELETE SAVED SEARCH ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to delete saved search." },
      { status: 500 },
    );
  }
}
