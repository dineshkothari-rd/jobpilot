"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowLeft, ArrowUpRight, Bell, BellRing, BriefcaseBusiness,
  Building2, Check, ExternalLink, Globe, MapPin,
  Sparkles, Star, ThumbsDown, ThumbsUp, Trash2, X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { safeExternalUrl } from "@/lib/utils";
import { type CompanyDetail } from "@/lib/companies/service";
import {
  type CompanyReviewRecord,
  type CompanyReviewSummary,
  type EmploymentStatus,
} from "@/lib/companies/reviews";

function initials(name: string | null) {
  return name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "CO";
}

function formatSalary(job: { salary_min: number | null; salary_max: number | null; salary_currency: string | null }) {
  if (job.salary_min == null && job.salary_max == null) return null;
  const currency = job.salary_currency?.trim() || "";
  const isINR = currency.toUpperCase() === "INR" || currency === "₹";

  if (isINR) {
    const toL = (v: number) => (v >= 100_000 ? `${(v / 100_000).toFixed(1)} LPA` : `₹${v.toLocaleString("en-IN")}`);
    if (job.salary_min != null && job.salary_max != null) {
      return `₹${toL(job.salary_min)} – ₹${toL(job.salary_max)}`;
    }
    if (job.salary_min != null) return `₹${toL(job.salary_min)}+`;
    return `Up to ₹${toL(job.salary_max as number)}`;
  }

  const format = (v: number) => v.toLocaleString("en-US");
  const prefix = currency ? `${currency} ` : "$";
  if (job.salary_min != null && job.salary_max != null) {
    return `${prefix}${format(job.salary_min)} – ${format(job.salary_max)}`;
  }
  if (job.salary_min != null) return `${prefix}${format(job.salary_min)}+`;
  return `Up to ${prefix}${format(job.salary_max as number)}`;
}

function StarRating({ score, max = 5, size = "size-4" }: { score: number; max?: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${score} out of ${max} stars`}>
      {Array.from({ length: max }, (_, i) => {
        const filled = i < Math.round(score);
        return (
          <Star
            key={i}
            className={`${size} ${filled ? "fill-amber-400 text-amber-400" : "fill-muted text-muted"}`}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}

export default function CompanyDetailPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Following state
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingBusy, setFollowingBusy] = useState(false);
  const [followNotice, setFollowNotice] = useState<string | null>(null);

  // Reviews state
  const [reviews, setReviews] = useState<CompanyReviewRecord[]>([]);
  const [reviewSummary, setReviewSummary] = useState<CompanyReviewSummary | null>(null);
  const [userReviewId, setUserReviewId] = useState<string | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  // Review form inputs
  const [rating, setRating] = useState(5);
  const [workLifeRating, setWorkLifeRating] = useState(5);
  const [growthRating, setGrowthRating] = useState(5);
  const [cultureRating, setCultureRating] = useState(5);
  const [roleTitle, setRoleTitle] = useState("");
  const [employmentStatus, setEmploymentStatus] = useState<EmploymentStatus>("current");
  const [reviewTitle, setReviewTitle] = useState("");
  const [pros, setPros] = useState("");
  const [cons, setCons] = useState("");

  const loadReviews = useCallback(async () => {
    if (!slug) return;
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(slug)}/reviews`);
      if (res.ok) {
        const data = await res.json();
        if (data.reviews) setReviews(data.reviews);
        if (data.summary) setReviewSummary(data.summary);
        if (data.userReviewId) setUserReviewId(data.userReviewId);
      }
    } catch (err) {
      console.warn("Reviews load error:", err);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    let ignore = false;

    async function loadInitial() {
      try {
        setError("");
        const [compRes, followRes, reviewRes] = await Promise.all([
          fetch(`/api/companies/${encodeURIComponent(slug)}`),
          fetch(`/api/companies/${encodeURIComponent(slug)}/follow`),
          fetch(`/api/companies/${encodeURIComponent(slug)}/reviews`),
        ]);

        if (ignore) return;

        const compData = await compRes.json().catch(() => null);
        if (!compRes.ok) throw new Error(compData?.error || "Company profile not found.");
        if (compData?.company) {
          setCompany(compData.company);
        }

        if (followRes.ok) {
          const followData = await followRes.json().catch(() => null);
          if (followData && typeof followData.isFollowing === "boolean") {
            setIsFollowing(followData.isFollowing);
            setFollowerCount(followData.followerCount || 0);
          }
        }

        if (reviewRes.ok) {
          const reviewData = await reviewRes.json().catch(() => null);
          if (reviewData?.reviews) setReviews(reviewData.reviews);
          if (reviewData?.summary) setReviewSummary(reviewData.summary);
          if (reviewData?.userReviewId) setUserReviewId(reviewData.userReviewId);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load company profile.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void loadInitial();

    return () => {
      ignore = true;
    };
  }, [slug]);

  const toggleFollow = async () => {
    if (followingBusy || !company) return;
    setFollowingBusy(true);
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    setFollowerCount((prev) => Math.max(0, prev + (nextFollowing ? 1 : -1)));

    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(slug)}/follow`, {
        method: nextFollowing ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: nextFollowing ? JSON.stringify({ companyName: company.name }) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setIsFollowing(!nextFollowing);
        setFollowerCount((prev) => Math.max(0, prev + (nextFollowing ? -1 : 1)));
        throw new Error(data?.error || "Failed to update follow status.");
      }
      setFollowNotice(
        nextFollowing
          ? `You are now following ${company.name}. You'll be alerted when new roles open.`
          : `Unfollowed ${company.name}.`,
      );
      setTimeout(() => setFollowNotice(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Authentication required to follow companies.");
    } finally {
      setFollowingBusy(false);
    }
  };

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewError("");
    setSubmittingReview(true);

    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(slug)}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          workLifeRating,
          growthRating,
          cultureRating,
          roleTitle: roleTitle.trim(),
          employmentStatus,
          title: reviewTitle.trim(),
          pros: pros.trim(),
          cons: cons.trim(),
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to submit review.");

      setShowReviewDialog(false);
      setFollowNotice("Thank you! Your employee review has been posted.");
      setTimeout(() => setFollowNotice(null), 4000);
      await loadReviews();
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Failed to submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleDeleteReview = async () => {
    if (!confirm("Are you sure you want to delete your review?")) return;
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(slug)}/reviews`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete review.");
      setUserReviewId(null);
      await loadReviews();
      setFollowNotice("Your review was deleted.");
      setTimeout(() => setFollowNotice(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete review.");
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-6 flex items-start gap-4">
          <div className="size-16 animate-pulse rounded-2xl bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <Building2 className="mx-auto size-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-bold">Company profile unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error || "We couldn't find this company."}</p>
        <div className="mt-6">
          <Link href="/companies" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="size-4" /> Back to company directory
          </Link>
        </div>
      </div>
    );
  }

  const websiteUrl = company.domain ? safeExternalUrl(`https://${company.domain}`) : null;

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/companies" className="hover:text-foreground">Companies</Link>
          <span>/</span>
          <span className="font-medium text-foreground">{company.name}</span>
        </nav>

        {followNotice && (
          <div role="status" aria-live="polite" className="mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-primary" />
              <span>{followNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setFollowNotice(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Company Header */}
        <header className="surface mt-5 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary sm:size-20">
                {initials(company.name)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {company.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="size-3" />
                    Verified Employer
                  </span>
                  {reviewSummary && reviewSummary.totalReviews > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                      <Star className="size-3 fill-amber-400 text-amber-400" />
                      {reviewSummary.averageRating} ({reviewSummary.totalReviews})
                    </span>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {company.locations.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {company.locations.slice(0, 3).join(", ")}
                    </span>
                  )}
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                    >
                      <Globe className="size-3.5" />
                      {company.domain}
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <BriefcaseBusiness className="size-3.5" />
                    {company.jobCount} open {company.jobCount === 1 ? "role" : "roles"}
                  </span>
                  {followerCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Bell className="size-3" />
                      {followerCount} {followerCount === 1 ? "follower" : "followers"}
                    </span>
                  )}
                </div>

                {company.skills.length > 0 && (
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Common skills:</span>
                    {company.skills.slice(0, 8).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                onClick={toggleFollow}
                disabled={followingBusy}
                className="gap-1.5"
                aria-pressed={isFollowing}
              >
                {isFollowing ? (
                  <>
                    <BellRing className="size-4 text-primary" />
                    <span>Following</span>
                    {followerCount > 0 && (
                      <span className="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground">
                        {followerCount}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Bell className="size-4" />
                    <span>Follow for alerts</span>
                    {followerCount > 0 && (
                      <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-[10px] font-bold">
                        {followerCount}
                      </span>
                    )}
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowReviewDialog(true)}
                className="gap-1.5"
              >
                <Star className="size-4 text-amber-500" />
                <span>Write review</span>
              </Button>
              <Link href="/jobs" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Explore all jobs
              </Link>
            </div>
          </div>
        </header>

        {/* Job Listings from this company */}
        <section className="mt-8" aria-labelledby="company-openings-heading">
          <div className="flex items-center justify-between">
            <h2 id="company-openings-heading" className="text-lg font-bold tracking-tight sm:text-xl">
              Current Openings ({company.jobCount})
            </h2>
            <p className="text-xs text-muted-foreground">Aggregated and verified from official career portals</p>
          </div>

          {company.jobs.length === 0 ? (
            <div className="surface mt-4 p-8 text-center">
              <p className="text-sm text-muted-foreground">No current active positions recorded for {company.name}.</p>
            </div>
          ) : (
            <div className="mt-4 divide-y rounded-xl border bg-card">
              {company.jobs.map((job) => {
                const salary = formatSalary(job);
                const applicationUrl = safeExternalUrl(job.application_url);
                return (
                  <article key={job.id} className="p-4 transition-colors hover:bg-muted/15 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="text-base font-semibold leading-6 tracking-tight hover:text-primary"
                        >
                          {job.title}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {job.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {job.location}
                            </span>
                          )}
                          {job.employment_type && <span>{job.employment_type}</span>}
                          {job.seniority && <span>{job.seniority}</span>}
                          {salary && <span className="font-medium text-foreground">{salary}</span>}
                          {job.source && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-medium">
                              {job.source}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Link href={`/jobs/${job.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Review role <ArrowUpRight className="size-3.5" />
                        </Link>
                        <Link href={`/jobs/${job.id}/prepare`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          Prepare interview
                        </Link>
                        {applicationUrl && (
                          <a
                            href={applicationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({ size: "sm" })}
                            aria-label={`Apply for ${job.title} on company site`}
                          >
                            Apply <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Employee Reviews & Ratings Section */}
        <section className="mt-12" aria-labelledby="company-reviews-heading">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="company-reviews-heading" className="text-lg font-bold tracking-tight sm:text-xl">
                Employee Reviews &amp; Ratings
              </h2>
              <p className="text-xs text-muted-foreground">
                Grounded employee and candidate feedback. Never fabricated or sponsored.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowReviewDialog(true)}
              className="self-start sm:self-auto"
            >
              <Star className="size-4 text-amber-500" />
              Write a review
            </Button>
          </div>

          {/* Rating Summary Card */}
          {reviewSummary && reviewSummary.totalReviews > 0 ? (
            <div className="surface mt-5 grid gap-6 p-6 sm:grid-cols-3">
              <div className="flex flex-col items-center justify-center border-b pb-6 sm:border-b-0 sm:border-r sm:pb-0">
                <span className="text-4xl font-black tracking-tight">{reviewSummary.averageRating}</span>
                <div className="mt-2">
                  <StarRating score={reviewSummary.averageRating} size="size-5" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Based on {reviewSummary.totalReviews} verified {reviewSummary.totalReviews === 1 ? "review" : "reviews"}
                </p>
              </div>

              {/* Category Breakdown */}
              <div className="space-y-3 sm:col-span-2 sm:pl-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Workplace dimensions</h3>
                <div className="grid gap-2 sm:grid-cols-3">
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Work-Life Balance</p>
                    <p className="mt-1 text-lg font-bold">
                      {reviewSummary.workLifeAvg ? `${reviewSummary.workLifeAvg} / 5` : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Career Growth</p>
                    <p className="mt-1 text-lg font-bold">
                      {reviewSummary.growthAvg ? `${reviewSummary.growthAvg} / 5` : "N/A"}
                    </p>
                  </div>
                  <div className="rounded-xl border bg-muted/20 p-3">
                    <p className="text-xs text-muted-foreground">Company Culture</p>
                    <p className="mt-1 text-lg font-bold">
                      {reviewSummary.cultureAvg ? `${reviewSummary.cultureAvg} / 5` : "N/A"}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="surface mt-5 p-8 text-center">
              <Star className="mx-auto size-10 text-muted-foreground/40" />
              <h3 className="mt-3 text-base font-semibold">No employee reviews yet</h3>
              <p className="mx-auto mt-1 max-w-md text-xs text-muted-foreground">
                Be the first verified team member, intern, or candidate to share honest feedback about working at {company.name}.
              </p>
              <div className="mt-4">
                <Button size="sm" onClick={() => setShowReviewDialog(true)}>
                  Share your experience
                </Button>
              </div>
            </div>
          )}

          {/* Reviews List */}
          {reviews.length > 0 && (
            <div className="mt-6 space-y-4">
              {reviews.map((r) => {
                const isUser = r.id === userReviewId;
                const statusLabel =
                  r.employment_status === "current"
                    ? "Current Employee"
                    : r.employment_status === "former"
                    ? "Former Employee"
                    : "Interviewee";

                return (
                  <article key={r.id} className="surface p-5 sm:p-6">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <StarRating score={r.rating} />
                          <h4 className="font-semibold text-foreground">{r.title}</h4>
                          {isUser && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                              Your review
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {r.role_title} · {statusLabel} · {new Date(r.created_at).toLocaleDateString()}
                        </p>
                      </div>

                      {isUser && (
                        <button
                          type="button"
                          onClick={() => void handleDeleteReview()}
                          className="inline-flex items-center gap-1 text-xs text-destructive hover:underline"
                          aria-label="Delete your review"
                        >
                          <Trash2 className="size-3" />
                          Delete
                        </button>
                      )}
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                          <ThumbsUp className="size-3.5" />
                          <span>Pros</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{r.pros}</p>
                      </div>

                      <div className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-3.5">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                          <ThumbsDown className="size-3.5" />
                          <span>Cons</span>
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-foreground/90">{r.cons}</p>
                      </div>
                    </div>

                    {(r.work_life_rating || r.growth_rating || r.culture_rating) && (
                      <div className="mt-3 flex flex-wrap items-center gap-3 border-t pt-3 text-[11px] text-muted-foreground">
                        {r.work_life_rating && <span>Work-Life: {r.work_life_rating}★</span>}
                        {r.growth_rating && <span>Growth: {r.growth_rating}★</span>}
                        {r.culture_rating && <span>Culture: {r.culture_rating}★</span>}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Write Review Dialog */}
        <Dialog.Root open={showReviewDialog} onOpenChange={setShowReviewDialog}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-foreground/35 backdrop-blur-sm transition-opacity" />
            <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-3xl border bg-background p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <Dialog.Title className="text-lg font-bold">Review {company.name}</Dialog.Title>
                  <Dialog.Description className="mt-0.5 text-xs text-muted-foreground">
                    Share honest feedback to help fellow professionals and job seekers.
                  </Dialog.Description>
                </div>
                <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Close dialog">
                  <X className="size-4" />
                </Dialog.Close>
              </div>

              {reviewError && (
                <div className="mb-4 rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                  {reviewError}
                </div>
              )}

              <form onSubmit={(e) => void handleReviewSubmit(e)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-semibold text-foreground">
                      Overall Rating (1–5 Stars)
                    </label>
                    <select
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                    >
                      <option value={5}>5 Stars - Outstanding</option>
                      <option value={4}>4 Stars - Good</option>
                      <option value={3}>3 Stars - Average</option>
                      <option value={2}>2 Stars - Below Average</option>
                      <option value={1}>1 Star - Poor</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground">
                      Employment Status
                    </label>
                    <select
                      value={employmentStatus}
                      onChange={(e) => setEmploymentStatus(e.target.value as EmploymentStatus)}
                      className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                    >
                      <option value="current">Current Employee</option>
                      <option value="former">Former Employee</option>
                      <option value="interviewee">Interviewed Candidate</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground">Work-Life</label>
                    <select
                      value={workLifeRating}
                      onChange={(e) => setWorkLifeRating(Number(e.target.value))}
                      className="mt-1 h-8 w-full rounded-lg border bg-background px-2 text-xs"
                    >
                      {[5, 4, 3, 2, 1].map((s) => (
                        <option key={s} value={s}>{s}★</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground">Growth</label>
                    <select
                      value={growthRating}
                      onChange={(e) => setGrowthRating(Number(e.target.value))}
                      className="mt-1 h-8 w-full rounded-lg border bg-background px-2 text-xs"
                    >
                      {[5, 4, 3, 2, 1].map((s) => (
                        <option key={s} value={s}>{s}★</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground">Culture</label>
                    <select
                      value={cultureRating}
                      onChange={(e) => setCultureRating(Number(e.target.value))}
                      className="mt-1 h-8 w-full rounded-lg border bg-background px-2 text-xs"
                    >
                      {[5, 4, 3, 2, 1].map((s) => (
                        <option key={s} value={s}>{s}★</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="role-title-input" className="block text-xs font-semibold text-foreground">
                    Your Role / Job Title
                  </label>
                  <input
                    id="role-title-input"
                    type="text"
                    required
                    value={roleTitle}
                    onChange={(e) => setRoleTitle(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer"
                    className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </div>

                <div>
                  <label htmlFor="review-title-input" className="block text-xs font-semibold text-foreground">
                    Review Headline
                  </label>
                  <input
                    id="review-title-input"
                    type="text"
                    required
                    value={reviewTitle}
                    onChange={(e) => setReviewTitle(e.target.value)}
                    placeholder="e.g. Collaborative team with strong engineering principles"
                    className="mt-1 h-9 w-full rounded-lg border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </div>

                <div>
                  <label htmlFor="review-pros-input" className="block text-xs font-semibold text-foreground">
                    Pros (What did you like?)
                  </label>
                  <textarea
                    id="review-pros-input"
                    required
                    rows={3}
                    value={pros}
                    onChange={(e) => setPros(e.target.value)}
                    placeholder="Describe positive aspects like culture, mentorship, benefits, flexibility..."
                    className="mt-1 w-full rounded-lg border bg-background p-2.5 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </div>

                <div>
                  <label htmlFor="review-cons-input" className="block text-xs font-semibold text-foreground">
                    Cons (Areas for improvement)
                  </label>
                  <textarea
                    id="review-cons-input"
                    required
                    rows={3}
                    value={cons}
                    onChange={(e) => setCons(e.target.value)}
                    placeholder="Describe challenges, work hours, bureaucracy, or areas needing improvement..."
                    className="mt-1 w-full rounded-lg border bg-background p-2.5 text-xs outline-none focus:ring-2 focus:ring-ring/40"
                  />
                </div>

                <div className="mt-5 flex items-center justify-end gap-2 border-t pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowReviewDialog(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={submittingReview}
                  >
                    {submittingReview ? "Submitting…" : "Publish Review"}
                  </Button>
                </div>
              </form>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </div>
    </div>
  );
}
