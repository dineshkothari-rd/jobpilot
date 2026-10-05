import { createClient } from "@/lib/supabase/server";
import { validateCompanySlug } from "@/lib/companies/follows";
import {
  calculateReviewSummary,
  validateReviewInput,
} from "@/lib/companies/reviews";

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

    const { data: reviews, error } = await supabase
      .from("company_reviews")
      .select("id, user_id, company_slug, rating, work_life_rating, growth_rating, culture_rating, title, pros, cons, role_title, employment_status, created_at, updated_at")
      .eq("company_slug", cleanSlug)
      .eq("is_approved", true)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(error.message);
    }

    const reviewList = reviews || [];
    const summary = calculateReviewSummary(reviewList);
    const userReview = user ? reviewList.find((r) => r.user_id === user.id) : null;

    return Response.json({
      reviews: reviewList,
      summary,
      userReviewId: userReview?.id || null,
    });
  } catch (err) {
    console.error("GET COMPANY REVIEWS ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Unable to load company reviews." },
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
      return Response.json({ error: "You must be logged in to submit a review." }, { status: 401 });
    }

    const body = await request.json().catch(() => null);
    const validated = validateReviewInput(body);

    const { data: saved, error: upsertErr } = await supabase
      .from("company_reviews")
      .upsert(
        {
          user_id: user.id,
          company_slug: cleanSlug,
          rating: validated.rating,
          work_life_rating: validated.workLifeRating ?? null,
          growth_rating: validated.growthRating ?? null,
          culture_rating: validated.cultureRating ?? null,
          title: validated.title,
          pros: validated.pros,
          cons: validated.cons,
          role_title: validated.roleTitle,
          employment_status: validated.employmentStatus,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id, company_slug" },
      )
      .select("id, user_id, company_slug, rating, work_life_rating, growth_rating, culture_rating, title, pros, cons, role_title, employment_status, created_at, updated_at")
      .single();

    if (upsertErr) {
      throw new Error(upsertErr.message);
    }

    return Response.json({ success: true, review: saved });
  } catch (err) {
    console.error("POST COMPANY REVIEW ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to submit review." },
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
      return Response.json({ error: "You must be logged in to delete your review." }, { status: 401 });
    }

    const { error: deleteErr } = await supabase
      .from("company_reviews")
      .delete()
      .eq("user_id", user.id)
      .eq("company_slug", cleanSlug);

    if (deleteErr) {
      throw new Error(deleteErr.message);
    }

    return Response.json({ success: true });
  } catch (err) {
    console.error("DELETE COMPANY REVIEW ERROR:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Failed to delete review." },
      { status: 500 },
    );
  }
}
