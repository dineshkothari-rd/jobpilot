"use client";

import { Dialog } from "@base-ui/react/dialog";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ExternalLink,
  Heart,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  TrendingUp,
  X,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { safeExternalUrl } from "@/lib/utils";

type Job = {
  id: string;
  title: string;
  company_name: string;
  description: string | null;
  location: string | null;
  employment_type: string | null;
  seniority?: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  application_url: string | null;
  published_at: string | null;
  skills: string[] | null;
};

type SavedJobRow = {
  job_id: string;
  jobs: Job | null;
};

type MatchedJob = {
  id: string;
  match_score?: number;
  match_breakdown?: {
    role?: number;
    skills?: number;
    location?: number;
    seniority?: number;
    salary?: number;
    country?: number;
  };
};

type Application = {
  id: string;
  job_id: string;
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

type Filter = "all" | "excellent" | "strong" | "applied";

const statusLabels: Record<Application["status"], string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

function formatDate(value: string | null) {
  if (!value) return "Date unavailable";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Date unavailable";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function formatSalary(job: Job) {
  if (job.salary_min == null && job.salary_max == null) {
    return null;
  }

  const currency = job.salary_currency || "";

  const formatNumber = (value: number) =>
    value.toLocaleString("en-IN", {
      maximumFractionDigits: 0,
    });

  if (job.salary_min != null && job.salary_max != null) {
    return `${currency} ${formatNumber(job.salary_min)} – ${formatNumber(
      job.salary_max,
    )}`;
  }

  if (job.salary_min != null) {
    return `${currency} ${formatNumber(job.salary_min)}+`;
  }

  return `Up to ${currency} ${formatNumber(job.salary_max as number)}`;
}

function getDescription(description: string | null) {
  if (!description) {
    return "No description available.";
  }

  const cleaned = description
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= 190) {
    return cleaned;
  }

  return `${cleaned.slice(0, 190)}...`;
}

function initials(name: string) {
  return (
    name
      .split(" ")
      .map((part) => part[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "JP"
  );
}

function scoreTone(score: number) {
  if (score >= 85) {
    return {
      text: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/20",
    };
  }

  if (score >= 70) {
    return {
      text: "text-primary",
      bg: "bg-primary/10",
      border: "border-primary/20",
    };
  }

  if (score >= 55) {
    return {
      text: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10",
      border: "border-amber-500/20",
    };
  }

  return {
    text: "text-muted-foreground",
    bg: "bg-muted",
    border: "border-border",
  };
}

function SkeletonCard() {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="p-5">
        <div className="flex gap-3">
          <div className="size-11 animate-pulse rounded-xl bg-muted" />

          <div className="flex-1">
            <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
            <div className="mt-2 h-3 w-1/3 animate-pulse rounded bg-muted" />
          </div>

          <div className="size-8 animate-pulse rounded-lg bg-muted" />
        </div>

        <div className="mt-5 h-3 w-full animate-pulse rounded bg-muted" />
        <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-muted" />

        <div className="mt-5 flex gap-2">
          <div className="h-7 w-20 animate-pulse rounded-lg bg-muted" />
          <div className="h-7 w-24 animate-pulse rounded-lg bg-muted" />
          <div className="h-7 w-20 animate-pulse rounded-lg bg-muted" />
        </div>

        <div className="mt-5 h-10 animate-pulse rounded-xl bg-muted" />
      </div>
    </div>
  );
}

export default function SavedJobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [matches, setMatches] = useState<Map<string, MatchedJob>>(
    new Map(),
  );
  const [applications, setApplications] = useState<
    Map<string, Application>
  >(new Map());

  const [loading, setLoading] = useState(true);
  const [removingJobId, setRemovingJobId] = useState<string | null>(
    null,
  );
  const [refreshing, setRefreshing] = useState(false);

  const [applyingJob, setApplyingJob] = useState<Job | null>(null);
  const [confirmingApplication, setConfirmingApplication] =
    useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [error, setError] = useState("");

  const loadSavedJobs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw new Error(userError.message);
      }

      if (!user) {
        throw new Error("You must be logged in.");
      }

      const [savedResult, matchResponse, applicationResponse] =
        await Promise.all([
          supabase
            .from("saved_jobs")
            .select(
              `
                job_id,
                jobs (
                  id,
                  title,
                  company_name,
                  description,
                  location,
                  employment_type,
                  seniority,
                  salary_min,
                  salary_max,
                  salary_currency,
                  application_url,
                  published_at,
                  skills
                )
              `,
            )
            .eq("user_id", user.id),

          fetch("/api/jobs/match", {
            cache: "no-store",
          }),

          fetch("/api/applications", {
            cache: "no-store",
          }),
        ]);

      if (savedResult.error) {
        throw new Error(savedResult.error.message);
      }

      const rows = (savedResult.data ||
        []) as unknown as SavedJobRow[];

      const savedJobs = rows
        .map((row) => row.jobs)
        .filter((job): job is Job => job !== null);

      setJobs(savedJobs);

      if (matchResponse.ok) {
        const matchResult = await matchResponse.json();

        const matchMap = new Map<string, MatchedJob>();

        for (const item of (matchResult.jobs || []) as MatchedJob[]) {
          matchMap.set(item.id, item);
        }

        setMatches(matchMap);
      } else {
        setMatches(new Map());
      }

      if (applicationResponse.ok) {
        const applicationResult =
          await applicationResponse.json();

        const applicationMap = new Map<string, Application>();

        for (const item of (applicationResult.applications ||
          []) as Application[]) {
          applicationMap.set(item.job_id, item);
        }

        setApplications(applicationMap);
      } else {
        setApplications(new Map());
      }
    } catch (loadError) {
      console.error("SAVED JOBS LOAD ERROR:", loadError);

      setError(
        loadError instanceof Error
          ? loadError.message
          : "Failed to load saved jobs.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSavedJobs();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [loadSavedJobs]);

  const refresh = async () => {
    try {
      setRefreshing(true);
      await loadSavedJobs();
    } finally {
      setRefreshing(false);
    }
  };

  const removeSavedJob = async (jobId: string) => {
    try {
      setRemovingJobId(jobId);
      setError("");

      const response = await fetch("/api/jobs/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId,
          action: "remove",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to remove saved job.",
        );
      }

      setJobs((previous) =>
        previous.filter((job) => job.id !== jobId),
      );
    } catch (removeError) {
      console.error("REMOVE SAVED JOB ERROR:", removeError);

      setError(
        removeError instanceof Error
          ? removeError.message
          : "Failed to remove saved job.",
      );
    } finally {
      setRemovingJobId(null);
    }
  };

  const openApplication = (job: Job) => {
    const applicationUrl = safeExternalUrl(job.application_url);
    if (!applicationUrl) {
      setError("This job does not have an application URL.");
      return;
    }

    window.open(
      applicationUrl,
      "_blank",
      "noopener,noreferrer",
    );

    setApplyingJob(job);
  };

  const confirmApplied = async () => {
    if (!applyingJob) return;

    try {
      setConfirmingApplication(true);
      setError("");

      const response = await fetch("/api/applications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          jobId: applyingJob.id,
          status: "applied",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Failed to record application.",
        );
      }

      if (result.application) {
        setApplications((current) => {
          const next = new Map(current);

          next.set(applyingJob.id, result.application);

          return next;
        });
      }

      setApplyingJob(null);
    } catch (applicationError) {
      console.error(
        "APPLICATION CREATE ERROR:",
        applicationError,
      );

      setError(
        applicationError instanceof Error
          ? applicationError.message
          : "Failed to record application.",
      );
    } finally {
      setConfirmingApplication(false);
    }
  };

  const filteredJobs = useMemo(() => {
    const query = search.trim().toLowerCase();

    return jobs.filter((job) => {
      const match = matches.get(job.id);
      const score = match?.match_score || 0;
      const application = applications.get(job.id);

      const matchesSearch =
        !query ||
        [
          job.title,
          job.company_name,
          job.location,
          job.employment_type,
          ...(job.skills || []),
        ]
          .filter(Boolean)
          .some((value) =>
            String(value).toLowerCase().includes(query),
          );

      if (!matchesSearch) return false;

      if (filter === "excellent") {
        return score >= 85;
      }

      if (filter === "strong") {
        return score >= 70;
      }

      if (filter === "applied") {
        return Boolean(application);
      }

      return true;
    });
  }, [applications, filter, jobs, matches, search]);

  const stats = useMemo(() => {
    const scores = jobs
      .map((job) => matches.get(job.id)?.match_score)
      .filter(
        (score): score is number => typeof score === "number",
      );

    const average =
      scores.length > 0
        ? Math.round(
            scores.reduce((sum, score) => sum + score, 0) /
              scores.length,
          )
        : 0;

    return {
      total: jobs.length,
      excellent: scores.filter((score) => score >= 85).length,
      strong: scores.filter((score) => score >= 70).length,
      applied: jobs.filter((job) =>
        applications.has(job.id),
      ).length,
      average,
    };
  }, [applications, jobs, matches]);

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Header */}
        <header className="animate-float-in">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Heart className="size-3.5 fill-current" />
                </span>

                <p className="section-label">Your shortlist</p>
              </div>

              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-[34px]">
                Saved jobs
              </h1>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Your shortlist, not submitted applications. Open a role to review it, then apply when you are ready.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void refresh()}
                disabled={refreshing || loading}
                aria-label="Refresh saved jobs"
              >
                <RefreshCw
                  className={`size-4 ${
                    refreshing ? "animate-spin" : ""
                  }`}
                />
                <span className="hidden sm:inline">
                  Refresh
                </span>
              </Button>

              <Link
                href="/jobs"
                className={buttonVariants({
                  size: "sm",
                })}
              >
                <BriefcaseBusiness className="size-4" />
                Find jobs
              </Link>
            </div>
          </div>
        </header>

        {/* Snapshot */}
        <section className="ai-surface interactive-card mt-6 rounded-2xl border p-4 sm:p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <Target className="size-5" />
              </div>

              <div>
                <p className="section-label">
                  A closer look at your shortlist
                </p>

                <p className="mt-1 text-sm font-semibold">
                  {stats.excellent > 0
                    ? `${stats.excellent} excellent match${
                        stats.excellent === 1 ? "" : "es"
                      } deserve attention.`
                    : stats.total > 0
                      ? "Review your saved roles and choose your next move."
                      : "Your shortlist is ready for its first opportunity."}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2 sm:flex">
              <MiniMetric
                label="Saved"
                value={stats.total}
              />

              <MiniMetric
                label="85%+"
                value={stats.excellent}
              />

              <MiniMetric
                label="70%+"
                value={stats.strong}
              />

              <MiniMetric
                label="Applied"
                value={stats.applied}
              />
            </div>
          </div>
        </section>

        {/* Search / filters */}
        <section className="mt-5 rounded-2xl border bg-background/90 p-3 shadow-sm backdrop-blur-xl sm:p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search saved roles, companies or skills..."
                className="h-11 w-full rounded-xl border bg-muted/30 pl-10 pr-10 text-sm outline-none transition focus:bg-background focus:ring-2 focus:ring-ring/40"
              />

              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            <div className="flex gap-1.5 overflow-x-auto pb-0.5">
              <FilterButton
                active={filter === "all"}
                onClick={() => setFilter("all")}
              >
                All
              </FilterButton>

              <FilterButton
                active={filter === "excellent"}
                onClick={() => setFilter("excellent")}
              >
                85%+ match
              </FilterButton>

              <FilterButton
                active={filter === "strong"}
                onClick={() => setFilter("strong")}
              >
                70%+ match
              </FilterButton>

              <FilterButton
                active={filter === "applied"}
                onClick={() => setFilter("applied")}
              >
                Applied
              </FilterButton>
            </div>
          </div>

          {!loading && (
            <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
              <span>
                Showing{" "}
                <strong className="text-foreground">
                  {filteredJobs.length}
                </strong>{" "}
                of {jobs.length} saved
              </span>

              <span className="hidden sm:inline">
                Average match{" "}
                <strong className="text-foreground">
                  {stats.average}%
                </strong>
              </span>
            </div>
          )}
        </section>

        {/* Error */}
        {error && (
          <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <span>{error}</span>

            <button
              type="button"
              onClick={() => setError("")}
              className="grid size-7 shrink-0 place-items-center rounded-lg hover:bg-destructive/10"
              aria-label="Dismiss error"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {/* Content */}
        <section className="mt-5">
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : jobs.length === 0 ? (
            <EmptyState />
          ) : filteredJobs.length === 0 ? (
            <div className="surface p-8 text-center sm:p-12">
              <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted">
                <Search className="size-6 text-muted-foreground" />
              </div>

              <h2 className="mt-4 text-lg font-bold">
                Nothing matches these filters
              </h2>

              <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Try another search or remove the active filter to see
                your complete shortlist.
              </p>

              <Button
                variant="outline"
                className="mt-5"
                onClick={() => {
                  setSearch("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredJobs.map((job) => {
                const match = matches.get(job.id);
                const score =
                  typeof match?.match_score === "number"
                    ? Math.round(match.match_score)
                    : null;

                const tone = scoreTone(score || 0);
                const application = applications.get(job.id);
                const salary = formatSalary(job);
                const removing = removingJobId === job.id;

                return (
                  <article
                    key={job.id}
                    className="interactive-card group overflow-hidden rounded-2xl border bg-card"
                  >
                    <div className="p-4 sm:p-5">
                      {/* Header */}
                      <div className="flex items-start gap-3">
                        <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-muted/60 text-xs font-bold text-muted-foreground">
                          {initials(job.company_name)}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {score !== null ? (
                              <span
                                className={`rounded-full border px-2.5 py-1 text-[10px] font-bold ${tone.bg} ${tone.text} ${tone.border}`}
                              >
                                {score}% match
                              </span>
                            ) : (
                              <span className="rounded-full border bg-muted px-2.5 py-1 text-[10px] font-medium text-muted-foreground">
                                Match unavailable
                              </span>
                            )}

                            {application && (
                              <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                                {statusLabels[application.status]}
                              </span>
                            )}
                          </div>

                          <h2 className="mt-2.5 line-clamp-2 text-[15px] font-bold leading-5 tracking-tight sm:text-base">
                            {job.title}
                          </h2>

                          <p className="mt-1 truncate text-xs font-medium text-muted-foreground">
                            {job.company_name}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            void removeSavedJob(job.id)
                          }
                          disabled={removing}
                          className="grid size-9 shrink-0 place-items-center rounded-xl border bg-background text-primary transition hover:bg-primary/10 disabled:opacity-50"
                          aria-label="Remove saved job"
                        >
                          {removing ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : (
                            <Heart className="size-4 fill-current" />
                          )}
                        </button>
                      </div>

                      {/* Meta */}
                      <div className="mt-4 flex flex-wrap gap-1.5">
                        {job.location && (
                          <MetaChip>
                            <MapPin className="size-3" />
                            {job.location}
                          </MetaChip>
                        )}

                        {job.employment_type && (
                          <MetaChip>
                            <BriefcaseBusiness className="size-3" />
                            {job.employment_type}
                          </MetaChip>
                        )}

                        {salary && (
                          <MetaChip>
                            <TrendingUp className="size-3" />
                            {salary}
                          </MetaChip>
                        )}

                        {job.published_at && (
                          <MetaChip>
                            <CalendarDays className="size-3" />
                            {formatDate(job.published_at)}
                          </MetaChip>
                        )}
                      </div>

                      {/* Description */}
                      <p className="mt-4 line-clamp-3 text-xs leading-5 text-muted-foreground">
                        {getDescription(job.description)}
                      </p>

                      {/* Skills */}
                      {job.skills && job.skills.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5">
                          {job.skills.slice(0, 5).map((skill) => (
                            <span
                              key={`${job.id}-${skill}`}
                              className="rounded-lg border bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground"
                            >
                              {skill}
                            </span>
                          ))}

                          {job.skills.length > 5 && (
                            <span className="rounded-lg border bg-muted/30 px-2 py-1 text-[10px] font-medium text-muted-foreground">
                              +{job.skills.length - 5}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Actions */}
                      <div className="mt-5 grid grid-cols-[1fr_auto] gap-2">
                        <Link
                          href={`/jobs/${job.id}`}
                          className={`${buttonVariants()} h-10`}
                        >
                          View opportunity
                          <ArrowRight className="size-3.5" />
                        </Link>

                        <Link
                          href={`/jobs/${job.id}/prepare`}
                          className={buttonVariants({
                            variant: "outline",
                            size: "icon",
                          })}
                          aria-label="Prepare for job"
                        >
                          <Sparkles />
                        </Link>
                      </div>

                      {safeExternalUrl(job.application_url) && !application && (
                        <Button
                          variant="ghost"
                          className="mt-2 h-9 w-full text-xs"
                          onClick={() => openApplication(job)}
                        >
                          Apply externally
                          <ExternalLink className="size-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Match context */}
                    <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 sm:px-5">
                      <div className="flex min-w-0 items-center gap-2">
                        <div
                          className={`grid size-6 shrink-0 place-items-center rounded-lg ${tone.bg} ${tone.text}`}
                        >
                          <Target className="size-3" />
                        </div>

                        <span className="truncate text-[10px] font-medium text-muted-foreground">
                          {score !== null
                            ? score >= 85
                              ? "Excellent fit for your profile"
                              : score >= 70
                                ? "Strong fit worth reviewing"
                                : "Potential fit — review details"
                            : "Complete profile for better matching"}
                        </span>
                      </div>

                      <Link
                        href={`/jobs/${job.id}`}
                        className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-primary"
                      >
                        Details
                        <ArrowRight className="size-3" />
                      </Link>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Source */}
        <footer className="mt-8 flex flex-col items-center justify-center gap-1 text-center text-[10px] leading-5 text-muted-foreground sm:flex-row">
          <span>Job listings are sourced from</span>

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
            JobPilot adds profile-based matching and application
            intelligence.
          </span>
        </footer>
      </div>

      {/* Apply confirmation */}
      {applyingJob && (
        <Dialog.Root open onOpenChange={(open) => !open && !confirmingApplication && setApplyingJob(null)}>
          <Dialog.Portal>
            <Dialog.Backdrop className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm" />
            <Dialog.Popup className="fixed inset-x-0 bottom-0 z-[61] w-full rounded-t-3xl border bg-background p-5 shadow-2xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <ExternalLink className="size-4" />
                </div>

                <Dialog.Title className="mt-4 text-lg font-bold">
                  Did you submit the application?
                </Dialog.Title>

                <Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">
                  The employer application opened in a new tab.
                  Confirm only after you have actually submitted it so
                  JobPilot keeps your application history accurate.
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
                {applyingJob.title}
              </p>

              <p className="mt-1 text-[11px] text-muted-foreground">
                {applyingJob.company_name}
              </p>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button
                variant="outline"
                onClick={() => setApplyingJob(null)}
                disabled={confirmingApplication}
              >
                Not yet
              </Button>

              <Button
                onClick={() => void confirmApplied()}
                disabled={confirmingApplication}
              >
                {confirmingApplication ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Check className="size-4" />
                )}
                Yes, I applied
              </Button>
            </div>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </main>
  );
}

function MetaChip({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-muted/70 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function MiniMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="min-w-0 rounded-xl border bg-background/60 px-2.5 py-2 text-center sm:min-w-[78px] sm:px-3">
      <p className="text-sm font-bold tracking-tight">{value}</p>

      <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 shrink-0 rounded-lg border px-3 text-xs font-semibold transition ${
        active
          ? "border-primary/20 bg-primary/10 text-primary"
          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="surface overflow-hidden p-8 text-center sm:p-12">
      <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary">
        <Heart className="size-7" />
      </div>

      <p className="section-label mt-5">Build your shortlist</p>

      <h2 className="mt-2 text-xl font-bold tracking-tight">
        No saved jobs yet
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">
        When you find an interesting opportunity, save it here.
        JobPilot will keep the role, match context and next actions
        together.
      </p>

      <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
        <Link
          href="/jobs"
          className={buttonVariants()}
        >
          <BriefcaseBusiness className="size-4" />
          Browse opportunities
          <ArrowRight className="size-3.5" />
        </Link>

        <Link
          href="/profile"
          className={buttonVariants({
            variant: "outline",
          })}
        >
          Tune profile
        </Link>
      </div>
    </div>
  );
}
