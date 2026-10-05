import { createClient } from "@/lib/supabase/server";
import { validateCompanySlug } from "@/lib/companies/follows";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  props: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await props.params;
    const cleanSlug = validateCompanySlug(slug);

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    // Check follower count
    const { count: followerCount, error: countErr } = await supabase
      .from("company_follows")
      .select("*", { count: "exact", head: true })
      .eq("company_slug", cleanSlug);

    if (countErr) {
      console.warn("Follower count query error:", countErr.message);
    }

    if (!user) {
      return Response.json({
        isFollowing: false,
        followerCount: followerCount || 0,
        notifyNewOpenings: false,
      });
    }

    const { data: followRecord, error: followErr } = await supabase
      .from("company_follows")
      .select("id, notify_new_openings")
      .eq("user_id", user.id)
      .eq("company_slug", cleanSlug)
      .maybeSingle();

    if (followErr) {
      console.warn("Follow record query error:", followErr.message);
    }

    return Response.json({
      isFollowing: Boolean(followRecord),
      followerCount: followerCount || 0,
      notifyNewOpenings: followRecord?.notify_new_openings ?? true,
    });
  } catch (err) {
    console.error("GET COMPANY FOLLOW ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to load follow status." },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await props.params;
    const cleanSlug = validateCompanySlug(slug);

    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return Response.json({ error: "You must be logged in to follow companies." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const companyName = typeof body.companyName === "string" && body.companyName.trim()
      ? body.companyName.trim().slice(0, 200)
      : cleanSlug;
    const notifyNewOpenings = typeof body.notifyNewOpenings === "boolean" ? body.notifyNewOpenings : true;

    const { error: upsertErr } = await supabase
      .from("company_follows")
      .upsert(
        {
          user_id: user.id,
          company_slug: cleanSlug,
          company_name: companyName,
          notify_new_openings: notifyNewOpenings,
        },
        { onConflict: "user_id, company_slug" },
      );

    if (upsertErr) {
      throw new Error(upsertErr.message);
    }

    // Get updated follower count
    const { count: followerCount } = await supabase
      .from("company_follows")
      .select("*", { count: "exact", head: true })
      .eq("company_slug", cleanSlug);

    return Response.json({
      success: true,
      isFollowing: true,
      followerCount: followerCount || 1,
      notifyNewOpenings,
    });
  } catch (err) {
    console.error("POST COMPANY FOLLOW ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to follow company." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: Request,
  props: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await props.params;
    const cleanSlug = validateCompanySlug(slug);

    const supabase = await createClient();
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return Response.json({ error: "You must be logged in to unfollow companies." }, { status: 401 });
    }

    const { error: deleteErr } = await supabase
      .from("company_follows")
      .delete()
      .eq("user_id", user.id)
      .eq("company_slug", cleanSlug);

    if (deleteErr) {
      throw new Error(deleteErr.message);
    }

    const { count: followerCount } = await supabase
      .from("company_follows")
      .select("*", { count: "exact", head: true })
      .eq("company_slug", cleanSlug);

    return Response.json({
      success: true,
      isFollowing: false,
      followerCount: followerCount || 0,
      notifyNewOpenings: false,
    });
  } catch (err) {
    console.error("DELETE COMPANY FOLLOW ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to unfollow company." },
      { status: 500 },
    );
  }
}
