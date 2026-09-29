"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import DOMPurify from "isomorphic-dompurify";
import { opportunityFreshness } from "@/lib/jobs/manual";
import {
  ArrowLeft,
  ArrowRight,
  BriefcaseBusiness,
  CalendarCheck2,
  Check,
  ExternalLink,
  FileText,
  Heart,
  Lightbulb,
  Loader2,
  MapPin,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { safeExternalUrl } from "@/lib/utils";

type MatchBreakdown = {
  role?: number;
  skills?: number;
  location?: number;
  seniority?: number;
  salary?: number;
  country?: number;
};

type MatchedJob = {
  id: string;
  title: string | null;
  company_name: string | null;
  match_score?: number;
  match_breakdown?: MatchBreakdown;
};

type Job = {
  id: string;
  title: string | null;
  company_name: string | null;
  description: string | null;
  location: string | null;
  country: string | null;
  employment_type: string | null;
  seniority: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  application_url: string | null;
  source_url: string | null;
  source: string | null;
  published_at: string | null;
  expires_at: string | null;
  is_user_added: boolean;
  version: number;
  skills: string[] | null;
};

type Application = {
  id: string;
  version: number;
  status:
    | "saved"
    | "applied"
    | "screening"
    | "interview"
    | "offer"
    | "rejected"
    | "withdrawn";
  applied_at: string | null;
  follow_up_at: string | null;
};

type JobResponse = {
  success?: boolean;
  job?: Job;
  saved?: boolean;
  application?: Application | null;
  error?: string;
};

type MatchResponse = {
  success?: boolean;
  jobs?: MatchedJob[];
  error?: string;
};

type PreparationResponse = {
  success?: boolean;
  preparation?: {
    summary?: string;
    readinessScore?: number;
    strengths?: string[];
    skillGaps?: string[];
    importantTopics?: string[];
  };
  error?: string;
};

const statusLabels: Record<Application["status"], string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function formatSalary(job: Job) {
  if (job.salary_min == null && job.salary_max == null) {
    return null;
  }

  const currency = job.salary_currency || "";

  const format = (value: number) =>
    value.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    });

  if (job.salary_min != null && job.salary_max != null) {
    return `${currency} ${format(job.salary_min)} – ${format(job.salary_max)}`;
  }

  if (job.salary_min != null) {
    return `${currency} ${format(job.salary_min)}+`;
  }

  return `Up to ${currency} ${format(job.salary_max as number)}`;
}

function initials(name: string | null) {
  if (!name) return "JP";

  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "JP"
  );
}

function getScoreTone(score: number) {
  if (score >= 85) {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
      track: "stroke-emerald-500",
    };
  }

  if (score >= 70) {
    return {
      text: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
      track: "stroke-primary",
    };
  }

  if (score >= 55) {
    return {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
      track: "stroke-amber-500",
    };
  }

  return {
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
    track: "stroke-muted-foreground",
  };
}

function SkeletonBlock({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-muted ${className}`}
    />
  );
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();

  const jobId = params.id;
  const requestedTab = searchParams.get("tab");

  const [job, setJob] = useState<Job | null>(null);
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [matchBreakdown, setMatchBreakdown] =
    useState<MatchBreakdown | null>(null);

  const [saved, setSaved] = useState(false);
  const [application, setApplication] =
    useState<Application | null>(null);

  const [preparation, setPreparation] =
    useState<PreparationResponse["preparation"] | null>(null);

  const [loading, setLoading] = useState(true);
  const [matchLoading, setMatchLoading] = useState(true);
  const [preparationLoading, setPreparationLoading] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [applying, setApplying] = useState(false);

  const [error, setError] = useState("");
  const [preparationError, setPreparationError] = useState("");
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false);

  const [activeTab, setActiveTab] = useState<
    "overview" | "preparation"
  >(
    requestedTab === "preparation"
      ? "preparation"
      : "overview",
  );

  const loadJob = useCallback(async () => {
    try {
      setLoading(true);
      setMatchLoading(true);
      setError("");

      const [jobResponse, matchResponse] = await Promise.all([
        fetch(`/api/jobs/${jobId}`, {
          cache: "no-store",
        }),
        fetch("/api/jobs/match", {
          cache: "no-store",
        }),
      ]);

      const jobResult = (await jobResponse.json()) as JobResponse;
      const matchResult =
        (await matchResponse.json()) as MatchResponse;

      if (!jobResponse.ok || !jobResult.job) {
        throw new Error(
          jobResult.error || "Unable to load this job.",
        );
      }

      setJob(jobResult.job);
      setSaved(Boolean(jobResult.saved));
      setApplication(jobResult.application || null);

      if (matchResponse.ok && Array.isArray(matchResult.jobs)) {
        const matchedJob = matchResult.jobs.find(
          (item) => item.id === jobId,
        );

        if (matchedJob) {
          setMatchScore(
            typeof matchedJob.match_score === "number"
              ? matchedJob.match_score
              : null,
          );

          setMatchBreakdown(
            matchedJob.match_breakdown || null,
          );
        } else {
          setMatchScore(null);
          setMatchBreakdown(null);
        }
      } else {
        setMatchScore(null);
        setMatchBreakdown(null);
      }
    } catch (loadError) {
      console.error("JOB DETAIL ERROR:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load this job.",
      );
    } finally {
      setLoading(false);
      setMatchLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadJob();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadJob]);

  const loadPreparation = useCallback(async () => {
    try {
      setPreparationLoading(true);
      setPreparationError("");

      const response = await fetch(
        `/api/jobs/${jobId}/prepare`,
        {
          cache: "no-store",
        },
      );

      const result =
        (await response.json()) as PreparationResponse;

      if (!response.ok || !result.preparation) {
        throw new Error(
          result.error ||
            "Unable to generate AI preparation.",
        );
      }

      setPreparation(result.preparation);
    } catch (preparationLoadError) {
      console.error(
        "JOB PREPARATION ERROR:",
        preparationLoadError,
      );

      setPreparationError(
        preparationLoadError instanceof Error
          ? preparationLoadError.message
          : "Unable to generate preparation.",
      );
    } finally {
      setPreparationLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (activeTab !== "preparation" || preparation) {
      return;
    }

    const timer = window.setTimeout(() => {
      void loadPreparation();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [activeTab, loadPreparation, preparation]);

  const toggleSave = async () => {
    if (saving) return;

    try {
      setSaving(true);
      setError("");

      const response = await fetch("/api/jobs/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          action: saved ? "remove" : "save",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to update saved job.",
        );
      }

      setSaved(Boolean(result.saved));
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Unable to update saved job.",
      );
    } finally {
      setSaving(false);
    }
  };

  const openApplyDialog = () => { setSubmissionConfirmed(false); setShowApplyModal(true); };
  const confirmApplication = async (didApply: boolean) => {
    if (!didApply) {
      setShowApplyModal(false);
      return;
    }
    if (!submissionConfirmed) return;

    try {
      setApplying(true);
      setError("");

      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          status: "applied",
          submissionConfirmed: true,
          ...(application ? { version: application.version } : {}),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Unable to track application.",
        );
      }

      setApplication(result.application || null);
      setShowApplyModal(false);
    } catch (applicationError) {
      setError(
        applicationError instanceof Error
          ? applicationError.message
          : "Unable to track application.",
      );
    } finally {
      setApplying(false);
    }
  };

  const salary = useMemo(
    () => (job ? formatSalary(job) : null),
    [job],
  );
  const freshness = job ? opportunityFreshness(job) : "current";
  const applicationUrl = freshness === "expired" ? null : safeExternalUrl(job?.application_url);

  const sanitizedDescription = useMemo(() => {
    if (!job?.description) return "";

    return DOMPurify.sanitize(job.description, {
      USE_PROFILES: {
        html: true,
      },
      FORBID_TAGS: [
        "script",
        "style",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "button",
      ],
      FORBID_ATTR: [
        "onerror",
        "onload",
        "onclick",
        "onmouseover",
        "onfocus",
      ],
    });
  }, [job]);

  const score = matchScore ?? 0;
  const scoreTone = getScoreTone(score);

  if (loading) {
    return (
      <main className="min-h-screen pb-24 md:pb-8">
        <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          <SkeletonBlock className="h-5 w-28" />

          <div className="mt-7 flex gap-4">
            <SkeletonBlock className="size-14 shrink-0 rounded-2xl" />

            <div className="flex-1">
              <SkeletonBlock className="h-4 w-24" />
              <SkeletonBlock className="mt-3 h-10 w-3/4 max-w-2xl" />
              <SkeletonBlock className="mt-3 h-4 w-40" />
            </div>
          </div>

          <SkeletonBlock className="mt-7 h-36 w-full rounded-2xl" />

          <div className="mt-7 grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-5">
              <SkeletonBlock className="h-12 w-full rounded-xl" />
              <SkeletonBlock className="h-72 w-full rounded-2xl" />
            </div>

            <SkeletonBlock className="h-80 w-full rounded-2xl" />
          </div>
        </div>
      </main>
    );
  }

  if (error || !job) {
    return (
      <main className="min-h-screen pb-24 md:pb-8">
        <div className="mx-auto max-w-2xl px-4 py-16 text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
            <BriefcaseBusiness className="size-6 text-muted-foreground" />
          </div>

          <h1 className="mt-5 text-xl font-bold">
            We couldn&apos;t load this opportunity
          </h1>

          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {error || "This job may no longer be available."}
          </p>

          <div className="mt-5 flex justify-center gap-2">
            <Button
              variant="outline"
              onClick={() => void loadJob()}
            >
              Try again
            </Button>

            <Link
              href="/jobs"
              className={buttonVariants()}
            >
              Back to jobs
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen pb-40 md:pb-8">
      <div className="mx-auto max-w-[1280px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Back */}
        <Link
          href="/jobs"
          className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Back to opportunities
        </Link>

        {/* Hero */}
        <section className="animate-float-in mt-6">
          {freshness !== "current" && <div className="mb-4 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200" role="status">{freshness === "expired" ? "This listing is recorded as closed or expired. Keep it for your history, but verify a new opening before applying." : "This listing is older than 45 days. Verify that it is still open before sharing personal information."}</div>}
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-3.5 sm:gap-4">
              <div className="grid size-12 shrink-0 place-items-center rounded-2xl border bg-card text-sm font-bold text-muted-foreground shadow-sm sm:size-14">
                {initials(job.company_name)}
              </div>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  {job.source && (
                    <span className="rounded-full border bg-muted/60 px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
                      {job.source}
                    </span>
                  )}

                  {application && (
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                      {statusLabels[application.status]}
                    </span>
                  )}
                </div>

                <h1 className="mt-2.5 max-w-3xl text-2xl font-bold tracking-tight sm:text-3xl lg:text-[36px] lg:leading-[1.15]">
                  {job.title || "Untitled position"}
                </h1>

                <p className="mt-1.5 text-sm font-medium text-muted-foreground">
                  {job.company_name || "Company"}
                </p>

                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
                  {job.location && (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="size-3.5" />
                      {job.location}
                    </span>
                  )}

                  {job.employment_type && (
                    <span className="inline-flex items-center gap-1.5">
                      <BriefcaseBusiness className="size-3.5" />
                      {job.employment_type}
                    </span>
                  )}

                  {job.seniority && (
                    <span className="inline-flex items-center gap-1.5">
                      <UserRound className="size-3.5" />
                      {job.seniority}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="hidden shrink-0 gap-2 lg:flex">
              <Button
                variant="outline"
                onClick={() => void toggleSave()}
                disabled={saving}
              >
                {saving ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Heart
                    className={`size-4 ${
                      saved ? "fill-current text-primary" : ""
                    }`}
                  />
                )}
                {saved ? "Saved" : "Save"}
              </Button>

              {applicationUrl && (
                <Button onClick={openApplyDialog}>
                  Apply now
                  <ExternalLink className="size-3.5" />
                </Button>
              )}
            </div>
          </div>
        </section>

        {/* Mobile actions */}
        <div className="mt-5 grid grid-cols-2 gap-2 lg:hidden">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => void toggleSave()}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Heart
                className={`size-4 ${
                  saved ? "fill-current text-primary" : ""
                }`}
              />
            )}
            {saved ? "Saved" : "Save job"}
          </Button>

          <Button
            className="w-full"
            onClick={openApplyDialog}
            disabled={!applicationUrl}
          >
            Apply now
            <ExternalLink className="size-3.5" />
          </Button>
        </div>

        {/* Match intelligence */}
        <section className="ai-surface interactive-card mt-5 overflow-hidden rounded-2xl border">
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-start gap-3.5">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Target className="size-5" />
                </div>

                <div className="min-w-0">
                  <p className="section-label">
                    Why this job might fit
                  </p>

                  <h2 className="mt-1 text-base font-bold">
                    Why this opportunity deserves a look
                  </h2>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Your profile, resume and preferences are compared
                    against this opportunity.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-5">
                {matchLoading ? (
                  <div className="flex items-center gap-3">
                    <Loader2 className="size-4 animate-spin text-primary" />
                    <span className="text-xs text-muted-foreground">
                      Calculating match...
                    </span>
                  </div>
                ) : matchScore !== null ? (
                  <div className="flex items-center gap-4">
                    <ScoreRing score={score} />

                    <div className="hidden h-12 w-px bg-border sm:block" />

                    <div className="hidden sm:block">
                      <p className="text-xs font-semibold">
                        Profile match
                      </p>

                      <p
                        className={`mt-1 text-xs font-medium ${scoreTone.text}`}
                      >
                        {score >= 85
                          ? "Excellent fit"
                          : score >= 70
                            ? "Strong fit"
                            : score >= 55
                              ? "Potential fit"
                              : "Needs review"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-sm font-semibold">
                      Match unavailable
                    </p>

                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Complete your profile to improve matching.
                    </p>
                  </div>
                )}

                <Link
                  href={`/jobs/${job.id}/prepare`}
                  className="hidden items-center gap-1.5 text-xs font-semibold text-primary sm:flex"
                >
                  AI preparation
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </div>

            {matchBreakdown && (
              <div className="mt-6 border-t pt-5">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <BreakdownItem
                    label="Role"
                    value={matchBreakdown.role}
                  />

                  <BreakdownItem
                    label="Skills"
                    value={matchBreakdown.skills}
                  />

                  <BreakdownItem
                    label="Location"
                    value={matchBreakdown.location}
                  />

                  <BreakdownItem
                    label="Experience"
                    value={matchBreakdown.seniority}
                  />

                  <BreakdownItem
                    label="Salary"
                    value={matchBreakdown.salary}
                  />

                  <BreakdownItem
                    label="Country"
                    value={matchBreakdown.country}
                  />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Tabs */}
        <div className="mt-6 border-b">
          <div className="flex gap-5 overflow-x-auto">
            <TabButton
              active={activeTab === "overview"}
              onClick={() => setActiveTab("overview")}
            >
              Overview
            </TabButton>

            <TabButton
              active={activeTab === "preparation"}
              onClick={() => setActiveTab("preparation")}
              icon={<Sparkles className="size-3.5" />}
            >
              AI Preparation
            </TabButton>
          </div>
        </div>

        {activeTab === "overview" ? (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
            <div className="min-w-0 space-y-6">
              <section className="grid gap-3 sm:grid-cols-2">
                <FactCard
                  icon={<TrendingUp />}
                  label="Compensation"
                  value={salary || "Not specified"}
                />

                <FactCard
                  icon={<MapPin />}
                  label="Location"
                  value={
                    job.location ||
                    job.country ||
                    "Remote / unspecified"
                  }
                />
              </section>

              {job.skills && job.skills.length > 0 && (
                <section className="surface p-5 sm:p-6">
                  <SectionHeading
                    eyebrow="What matters"
                    title="Skills & requirements"
                  />

                  <div className="mt-4 flex flex-wrap gap-2">
                    {job.skills.map((skill) => (
                      <span
                        key={skill}
                        className="rounded-xl border bg-muted/40 px-3 py-2 text-xs font-medium text-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Proper HTML description */}
              <section className="surface overflow-hidden">
                <div className="border-b px-5 py-4 sm:px-6">
                  <SectionHeading
                    eyebrow="The opportunity"
                    title="Job description"
                  />
                </div>

                <div className="job-description p-5 sm:p-6">
                  {sanitizedDescription ? (
                    <div
                      dangerouslySetInnerHTML={{
                        __html: sanitizedDescription,
                      }}
                    />
                  ) : (
                    <p className="text-sm leading-7 text-muted-foreground">
                      No detailed job description is available for
                      this opportunity.
                    </p>
                  )}
                </div>
              </section>
            </div>

            <aside className="space-y-5">
              <section className="surface p-5">
                <SectionHeading
                  eyebrow="Your next move"
                  title="Prepare before you apply"
                />

                <p className="mt-2 text-xs leading-5 text-muted-foreground">
                  Get a focused preparation plan, identify skill gaps
                  and understand what to prioritize for this role.
                </p>

                <Link
                  href={`/jobs/${job.id}/prepare`}
                  className={`${buttonVariants()} mt-4 w-full`}
                >
                  <Sparkles className="size-4" />
                  Prepare with AI
                  <ArrowRight className="ml-auto size-3.5" />
                </Link>
              </section>

              <section className="surface p-5">
                <SectionHeading
                  eyebrow="Application"
                  title={
                    application
                      ? "Application in progress"
                      : "Ready to apply?"
                  }
                />

                {application ? (
                  <>
                    <div className="mt-4 rounded-xl bg-primary/5 p-3.5">
                      <p className="text-xs font-semibold text-primary">
                        {statusLabels[application.status]}
                      </p>

                      <p className="mt-1 text-[11px] leading-5 text-muted-foreground">
                        Track the rest of your journey from your
                        Applications workspace.
                      </p>
                    </div>

                    <Link
                      href="/applications"
                      className={`${buttonVariants({
                        variant: "outline",
                      })} mt-3 w-full`}
                    >
                      Open application
                      <ArrowRight className="ml-auto size-3.5" />
                    </Link>
                  </>
                ) : (
                  <Button
                    className="mt-4 w-full"
                    onClick={openApplyDialog}
                    disabled={!applicationUrl}
                  >
                    Apply to this role
                    <ExternalLink className="size-3.5" />
                  </Button>
                )}
              </section>

              <section className="rounded-2xl border border-primary/10 bg-primary/[0.035] p-5">
                <div className="flex items-start gap-3">
                  <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <Lightbulb className="size-4" />
                  </div>

                  <div>
                    <p className="text-xs font-bold">
                      JobPilot tip
                    </p>

                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Review the role requirements before submitting.
                      AI suggestions are designed to help you make the
                      final decision — not apply blindly.
                    </p>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        ) : (
          <section className="mt-6">
            {preparationLoading ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="space-y-5">
                  <SkeletonBlock className="h-36 rounded-2xl" />
                  <SkeletonBlock className="h-52 rounded-2xl" />
                  <SkeletonBlock className="h-52 rounded-2xl" />
                </div>

                <SkeletonBlock className="h-72 rounded-2xl" />
              </div>
            ) : preparationError ? (
              <div className="surface p-8 text-center">
                <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
                  <Sparkles className="size-5" />
                </div>

                <h2 className="mt-4 font-bold">
                  AI preparation is unavailable
                </h2>

                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                  {preparationError}
                </p>

                <Button
                  className="mt-5"
                  onClick={() => void loadPreparation()}
                >
                  Try again
                </Button>
              </div>
            ) : preparation ? (
              <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                <div className="min-w-0 space-y-5">
                  <section className="ai-surface interactive-card rounded-2xl border p-5 sm:p-6">
                    <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="section-label">
                          AI readiness
                        </p>

                        <h2 className="mt-1 text-lg font-bold">
                          Your preparation snapshot
                        </h2>

                        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                          {preparation.summary ||
                            "A focused preparation plan based on this role and your profile."}
                        </p>
                      </div>

                      <div
                        className={`flex size-24 shrink-0 flex-col items-center justify-center rounded-full border-8 ${getScoreTone(
                          readinessScore(preparation.readinessScore),
                        ).border} ${getScoreTone(
                          readinessScore(preparation.readinessScore),
                        ).bg}`}
                      >
                        <span
                          className={`text-2xl font-bold ${getScoreTone(
                            readinessScore(preparation.readinessScore),
                          ).text}`}
                        >
                          {readinessScore(
                            preparation.readinessScore,
                          )}
                          %
                        </span>

                        <span className="text-[9px] font-bold uppercase tracking-wide text-muted-foreground">
                          ready
                        </span>
                      </div>
                    </div>
                  </section>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <InsightList
                      title="Your strengths"
                      eyebrow="Use these"
                      icon={<Check />}
                      items={preparation.strengths || []}
                      empty="No specific strengths identified yet."
                    />

                    <InsightList
                      title="Skill gaps"
                      eyebrow="Focus here"
                      icon={<Target />}
                      items={preparation.skillGaps || []}
                      empty="No major gaps identified."
                    />
                  </div>

                  <InsightList
                    title="Important topics"
                    eyebrow="Prepare for"
                    icon={<Lightbulb />}
                    items={preparation.importantTopics || []}
                    empty="No additional topics identified."
                  />
                </div>

                <aside className="space-y-5">
                  <section className="surface p-5">
                    <SectionHeading
                      eyebrow="Continue"
                      title="Turn preparation into action"
                    />

                    <div className="mt-4 space-y-2">
                      <Link
                        href={`/jobs/${job.id}/interview`}
                        className={`${buttonVariants()} w-full`}
                      >
                        <Sparkles className="size-4" />
                        Start Interview Studio
                        <ArrowRight className="ml-auto size-3.5" />
                      </Link>

                      <Link
                        href={`/jobs/${job.id}/copilot`}
                        className={`${buttonVariants({
                          variant: "outline",
                        })} w-full`}
                      >
                        <FileText className="size-4" />
                        Open Application Copilot
                        <ArrowRight className="ml-auto size-3.5" />
                      </Link>
                    </div>
                  </section>

                  <section className="surface p-5">
                    <SectionHeading
                      eyebrow="Role context"
                      title="Opportunity details"
                    />

                    <div className="mt-4 space-y-3">
                      <DetailRow
                        icon={<MapPin />}
                        label="Location"
                        value={
                          job.location ||
                          job.country ||
                          "Not specified"
                        }
                      />

                      <DetailRow
                        icon={<BriefcaseBusiness />}
                        label="Employment"
                        value={
                          job.employment_type ||
                          "Not specified"
                        }
                      />

                      <DetailRow
                        icon={<TrendingUp />}
                        label="Compensation"
                        value={salary || "Not specified"}
                      />
                    </div>
                  </section>
                </aside>
              </div>
            ) : null}
          </section>
        )}

        <footer className="mt-8 flex flex-col items-center justify-center gap-1 text-center text-[10px] leading-5 text-muted-foreground sm:flex-row">
          <span>Opportunity data provided through</span>

          <a
            href="https://himalayas.app/jobs"
            target="_blank"
            rel="noreferrer"
            className="font-semibold underline underline-offset-2 hover:text-foreground"
          >
            Himalayas
          </a>

          <span className="hidden sm:inline">•</span>

          <span>
            JobPilot adds profile-based matching and preparation.
          </span>
        </footer>
      </div>

      {/* Mobile sticky actions */}
      <div className="fixed inset-x-0 bottom-[4.5rem] z-40 border-t border-border/70 bg-background/95 px-3 py-2.5 shadow-[0_-12px_35px_-25px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-2xl gap-2">
          <Button
            variant="outline"
            size="icon"
            className="shrink-0"
            onClick={() => void toggleSave()}
            disabled={saving}
            aria-label={saved ? "Unsave job" : "Save job"}
          >
            {saving ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Heart
                className={`size-4 ${
                  saved ? "fill-current text-primary" : ""
                }`}
              />
            )}
          </Button>

          <Link
            href={`/jobs/${job.id}/prepare`}
            className={`${buttonVariants({
              variant: "secondary",
            })} flex-1`}
          >
            <Sparkles className="size-4" />
            Prepare
          </Link>

          <Button
            className="flex-1"
            onClick={openApplyDialog}
            disabled={!applicationUrl}
          >
            Apply
            <ArrowRight className="size-3.5" />
          </Button>
        </div>
      </div>

      {/* Apply confirmation */}
      <Dialog.Root open={showApplyModal} onOpenChange={(open) => !applying && setShowApplyModal(open)}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm" />
          <Dialog.Popup className="fixed inset-x-0 bottom-0 z-[61] w-full rounded-t-3xl border bg-background p-5 shadow-2xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="grid size-9 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ExternalLink className="size-4" />
                </div>

                <Dialog.Title className="mt-4 text-lg font-bold">
                  Apply on the company form
                </Dialog.Title>

                <Dialog.Description className="mt-1.5 text-sm leading-6 text-muted-foreground">
                  JobPilot will open the employer&apos;s application
                  page. After you submit it, come back and confirm so
                  we can track the application accurately.
                </Dialog.Description>
              </div>

              <Dialog.Close
                className="grid size-8 shrink-0 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Close apply dialog"
              >
                <X className="size-4" />
              </Dialog.Close>
            </div>

            <div className="mt-5 rounded-xl border bg-muted/30 p-3.5">
              <p className="text-xs font-semibold">
                {job.title}
              </p>

              <p className="mt-1 text-[11px] text-muted-foreground">
                {job.company_name}
              </p>
            </div>

            {applicationUrl ? <a href={applicationUrl} target="_blank" rel="noopener noreferrer" className={`${buttonVariants()} mt-5 w-full`}>Open company form<ExternalLink /></a> : <p className="mt-5 text-sm text-muted-foreground">Company application link unavailable.</p>}
            <label className="mt-4 flex min-h-11 items-start gap-2 text-sm leading-6"><input type="checkbox" checked={submissionConfirmed} onChange={(event) => setSubmissionConfirmed(event.target.checked)} className="mt-1.5" />The company confirmed my successful submission.</label>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => void confirmApplication(false)}
                disabled={applying}
              >
                Not yet
              </Button>

              <Button
                onClick={() => void confirmApplication(true)}
                disabled={applying || !submissionConfirmed}
              >
                {applying ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CalendarCheck2 className="size-4" />
                )}
                I applied
              </Button>
            </div>

            <p className="mt-3 text-center text-[10px] leading-4 text-muted-foreground">
              Only confirm after submitting the application.
            </p>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </main>
  );
}

function readinessScore(value?: number) {
  return typeof value === "number"
    ? Math.max(0, Math.min(100, Math.round(value)))
    : 0;
}

function ScoreRing({ score }: { score: number }) {
  const tone = getScoreTone(score);
  const radius = 23;
  const circumference = 2 * Math.PI * radius;
  const progress = circumference - (score / 100) * circumference;

  return (
    <div className="relative size-16 shrink-0">
      <svg
        viewBox="0 0 56 56"
        className="size-16 -rotate-90"
        aria-hidden="true"
      >
        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted/60"
          strokeWidth="5"
        />

        <circle
          cx="28"
          cy="28"
          r={radius}
          fill="none"
          className={tone.track}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={progress}
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center">
        <span className={`text-sm font-bold ${tone.text}`}>
          {score}%
        </span>
      </div>
    </div>
  );
}

function BreakdownItem({
  label,
  value,
}: {
  label: string;
  value?: number;
}) {
  const safeValue =
    typeof value === "number"
      ? Math.max(0, Math.min(100, Math.round(value)))
      : 0;

  return (
    <div className="rounded-xl border bg-background/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-muted-foreground">
          {label}
        </span>

        <span className="text-[10px] font-bold">
          {typeof value === "number" ? `${safeValue}%` : "—"}
        </span>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{
            width: `${safeValue}%`,
          }}
        />
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-11 shrink-0 items-center gap-1.5 border-b-2 px-1 text-xs font-semibold transition-colors ${
        active
          ? "border-primary text-primary"
          : "border-transparent text-muted-foreground hover:text-foreground"
      }`}
    >
      {icon}
      {children}
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
}: {
  eyebrow: string;
  title: string;
}) {
  return (
    <div>
      <p className="section-label">{eyebrow}</p>

      <h2 className="mt-1 text-base font-bold tracking-tight">
        {title}
      </h2>
    </div>
  );
}

function FactCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="interactive-card rounded-2xl border bg-card p-4">
      <div className="flex items-center gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground">
          <span className="[&_svg]:size-4">{icon}</span>
        </div>

        <div className="min-w-0">
          <p className="section-label">{label}</p>

          <p className="mt-1 truncate text-sm font-semibold">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function InsightList({
  eyebrow,
  title,
  icon,
  items,
  empty,
}: {
  eyebrow: string;
  title: string;
  icon: React.ReactNode;
  items: string[];
  empty: string;
}) {
  return (
    <section className="surface p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <span className="[&_svg]:size-4">{icon}</span>
        </div>

        <SectionHeading eyebrow={eyebrow} title={title} />
      </div>

      {items.length > 0 ? (
        <div className="mt-4 space-y-2.5">
          {items.map((item) => (
            <div
              key={item}
              className="flex gap-2.5 rounded-xl bg-muted/40 px-3 py-2.5 text-xs leading-5"
            >
              <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />
              <span>{item}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-4 rounded-xl bg-muted/40 p-3 text-xs leading-5 text-muted-foreground">
          {empty}
        </p>
      )}
    </section>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground [&_svg]:size-3.5">
        {icon}
      </div>

      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>

        <p className="mt-0.5 text-xs font-semibold leading-5">
          {value}
        </p>
      </div>
    </div>
  );
}
