"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import { getTimeOfDayGreeting } from "@/lib/greeting";
import { createClient } from "@/lib/supabase/client";
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  FileText,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  title: string;
  company_name: string;
  location: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  application_url: string | null;
  match_score?: number;
};

type ApplicationStatus =
  | "saved"
  | "applied"
  | "screening"
  | "interview"
  | "offer"
  | "rejected"
  | "withdrawn";

type Application = {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  follow_up_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  jobs:
    | {
        id: string;
        title: string;
        company_name: string;
        location: string | null;
        application_url: string | null;
      }
    | {
        id: string;
        title: string;
        company_name: string;
        location: string | null;
        application_url: string | null;
      }[]
    | null;
};

type DashboardData = {
  jobs: Job[];
  savedCount: number;
  applications: Application[];
};

const statusLabels: Record<ApplicationStatus, string> = {
  saved: "Saved",
  applied: "Applied",
  screening: "Screening",
  interview: "Interview",
  offer: "Offer",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const statusTone: Record<ApplicationStatus, string> = {
  saved: "bg-muted text-muted-foreground",
  applied: "bg-blue-500/10 text-blue-700 dark:text-blue-300",
  screening: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  interview: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  offer: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  rejected: "bg-rose-500/10 text-rose-700 dark:text-rose-300",
  withdrawn: "bg-muted text-muted-foreground",
};

function getApplicationJob(application: Application) {
  return Array.isArray(application.jobs)
    ? application.jobs[0] || null
    : application.jobs;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Not set";
  }

  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

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

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-muted ${className}`}
      aria-hidden="true"
    />
  );
}

function StatCard({
  label,
  value,
  meta,
  icon: Icon,
  href,
  loading,
}: {
  label: string;
  value: string | number;
  meta: string;
  icon: typeof BriefcaseBusiness;
  href: string;
  loading: boolean;
}) {
  return (
    <Link
      href={href}
      className="interactive-card group rounded-2xl border bg-card p-4 sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex size-9 items-center justify-center rounded-xl bg-muted text-muted-foreground transition-colors duration-200 group-hover:bg-primary/10 group-hover:text-primary">
          <Icon className="size-4" />
        </div>

        <ChevronRight className="size-4 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
      </div>

      <div className="mt-4">
        {loading ? (
          <>
            <Skeleton className="h-7 w-16" />
            <Skeleton className="mt-2 h-3 w-20" />
          </>
        ) : (
          <>
            <p className="text-2xl font-bold tracking-tight">{value}</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">
              {label}
            </p>
          </>
        )}

        {!loading && (
          <p className="mt-3 text-[11px] font-medium text-muted-foreground">
            {meta}
          </p>
        )}
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData>({
    jobs: [],
    savedCount: 0,
    applications: [],
  });

  const [userName, setUserName] = useState("there");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [currentTime, setCurrentTime] = useState<number | null>(null);
  const greeting = currentTime === null
    ? "Welcome"
    : getTimeOfDayGreeting(new Date(currentTime));

  const loadDashboard = useCallback(async (refresh = false) => {
    try {
      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");
      setCurrentTime(Date.now());

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

      const firstName =
        user.user_metadata?.full_name?.split(" ")[0] ||
        user.email?.split("@")[0] ||
        "there";

      setUserName(firstName);

      const [matchResponse, savedResponse, applicationsResponse] =
        await Promise.all([
          fetch("/api/jobs/match", {
            cache: "no-store",
          }),

          supabase
            .from("saved_jobs")
            .select("job_id", {
              count: "exact",
              head: true,
            })
            .eq("user_id", user.id),

          fetch("/api/applications", {
            cache: "no-store",
          }),
        ]);

      const matchResult = await matchResponse.json();
      const applicationsResult = await applicationsResponse.json();

      if (!matchResponse.ok) {
        throw new Error(matchResult.error || "Failed to load matched jobs.");
      }

      if (!applicationsResponse.ok) {
        throw new Error(
          applicationsResult.error || "Failed to load applications.",
        );
      }

      if (savedResponse.error) {
        throw new Error(savedResponse.error.message);
      }

      setData({
        jobs: (matchResult.jobs || []) as Job[],
        savedCount: savedResponse.count || 0,
        applications: (applicationsResult.applications || []) as Application[],
      });
    } catch (dashboardError) {
      console.error("DASHBOARD LOAD ERROR:", dashboardError);

      setError(
        dashboardError instanceof Error
          ? dashboardError.message
          : "Failed to load dashboard.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDashboard();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadDashboard]);

  const stats = useMemo(() => {
    const applications = data.applications;

    const applied = applications.filter(
      (item) => item.status === "applied",
    ).length;

    const screening = applications.filter(
      (item) => item.status === "screening",
    ).length;

    const interviews = applications.filter(
      (item) => item.status === "interview",
    ).length;

    const offers = applications.filter(
      (item) => item.status === "offer",
    ).length;

    const rejected = applications.filter(
      (item) => item.status === "rejected",
    ).length;

    const responses = screening + interviews + offers;

    const responseRate = applications.length
      ? Math.round((responses / applications.length) * 100)
      : 0;

    const averageMatch = data.jobs.length
      ? Math.round(
          data.jobs.reduce((sum, job) => sum + (job.match_score || 0), 0) /
            data.jobs.length,
        )
      : 0;

    return {
      total: applications.length,
      applied,
      screening,
      interviews,
      offers,
      rejected,
      responseRate,
      averageMatch,
    };
  }, [data]);

  const topJobs = useMemo(
    () =>
      [...data.jobs]
        .sort((a, b) => (b.match_score || 0) - (a.match_score || 0))
        .slice(0, 4),
    [data.jobs],
  );

  const upcomingFollowUps = useMemo(
    () =>
      data.applications
        .filter(
          (application) =>
            application.follow_up_at &&
            currentTime !== null &&
            new Date(application.follow_up_at).getTime() >= currentTime,
        )
        .sort(
          (a, b) =>
            new Date(a.follow_up_at as string).getTime() -
            new Date(b.follow_up_at as string).getTime(),
        )
        .slice(0, 3),
    [data.applications, currentTime],
  );

  const recentApplications = useMemo(
    () =>
      [...data.applications]
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        )
        .slice(0, 4),
    [data.applications],
  );

  const nextAction = useMemo(() => {
    if (data.jobs.length === 0) {
      return {
        eyebrow: "Start here",
        title: "Find your first strong match",
        text: "Refresh your job matches and let JobPilot surface roles aligned with your profile.",
        href: "/jobs",
        cta: "Find matching jobs",
        icon: BriefcaseBusiness,
      };
    }

    if (upcomingFollowUps[0]) {
      const job = getApplicationJob(upcomingFollowUps[0]);

      return {
        eyebrow: "Next best action",
        title: "Follow up on an application",
        text: `${job?.company_name || "An employer"} is next on your follow-up list.`,
        href: "/applications",
        cta: "Review applications",
        icon: CalendarClock,
      };
    }

    if (stats.total === 0) {
      return {
        eyebrow: "Next best action",
        title: "Turn a match into an application",
        text: "You have matched opportunities waiting. Pick one strong role and move it forward.",
        href: "/jobs",
        cta: "Explore top matches",
        icon: Target,
      };
    }

    return {
      eyebrow: "Next best action",
      title: "Prepare for your strongest opportunity",
      text: `Your average match is ${stats.averageMatch}%. Use AI preparation before applying to your best-fit role.`,
      href: topJobs[0] ? `/jobs/${topJobs[0].id}/prepare` : "/jobs",
      cta: "Prepare for a role",
      icon: Sparkles,
    };
  }, [data.jobs.length, upcomingFollowUps, stats, topJobs]);

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Header */}
        <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="section-label">Career command center</p>

            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl lg:text-[34px]">
              {greeting}, {userName}.
            </h1>

            <p className="mt-1.5 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              Here&apos;s what deserves your attention today.
            </p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDashboard(true)}
              disabled={loading || refreshing}
            >
              <RefreshCw
                className={`size-4 ${refreshing ? "animate-spin" : ""}`}
              />

              <span className="hidden sm:inline">Refresh</span>
            </Button>

            <Link
              href="/jobs"
              className={buttonVariants({
                size: "sm",
              })}
            >
              <BriefcaseBusiness />
              <span>Find jobs</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </header>

        {/* Error */}
        {error && (
          <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between">
            <span>{error}</span>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void loadDashboard()}
            >
              Retry
            </Button>
          </div>
        )}

        {/* Next Best Action */}
        <section className="ai-surface interactive-card animate-float-in mt-6 overflow-hidden rounded-2xl border p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-3xl">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.1em] text-primary">
                <span className="grid size-7 place-items-center rounded-lg bg-primary/10">
                  <Sparkles className="size-3.5" />
                </span>

                {nextAction.eyebrow}
              </div>

              <h2 className="mt-3 text-xl font-bold tracking-tight sm:text-2xl">
                {nextAction.title}
              </h2>

              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                {nextAction.text}
              </p>

              <Link
                href={nextAction.href}
                className={`${buttonVariants()} mt-5`}
              >
                <nextAction.icon className="size-4" />
                {nextAction.cta}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="hidden shrink-0 lg:block">
              <div className="relative grid size-32 place-items-center rounded-full border border-primary/15 bg-background/50 shadow-sm">
                <div className="absolute inset-2 rounded-full border border-primary/10" />

                <div className="text-center">
                  <Sparkles className="mx-auto size-5 text-primary" />

                  <p className="mt-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    AI guided
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard
            label="Matched jobs"
            value={data.jobs.length}
            meta={
              data.jobs.length
                ? "Relevant opportunities"
                : "Discover opportunities"
            }
            icon={BriefcaseBusiness}
            href="/jobs"
            loading={loading}
          />

          <StatCard
            label="Average match"
            value={`${stats.averageMatch}%`}
            meta="Across current matches"
            icon={Target}
            href="/jobs"
            loading={loading}
          />

          <StatCard
            label="Saved jobs"
            value={data.savedCount}
            meta="Roles worth revisiting"
            icon={Sparkles}
            href="/saved-jobs"
            loading={loading}
          />

          <StatCard
            label="Applications"
            value={stats.total}
            meta={
              stats.total
                ? `${stats.responseRate}% response rate`
                : "Start your pipeline"
            }
            icon={FileText}
            href="/applications"
            loading={loading}
          />
        </section>

        {/* Main Grid */}
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,0.75fr)]">
          {/* Top Matches */}
          <section className="surface overflow-hidden">
            <div className="flex items-center justify-between gap-4 border-b px-5 py-4 sm:px-6">
              <div>
                <p className="section-label">Recommended for you</p>

                <h2 className="mt-1 text-base font-semibold">
                  Top job matches
                </h2>
              </div>

              <Link
                href="/jobs"
                className="hidden items-center gap-1 text-xs font-semibold text-primary sm:flex"
              >
                View all
                <ArrowRight className="size-3.5" />
              </Link>
            </div>

            <div className="divide-y">
              {loading ? (
                Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="flex gap-4 p-5">
                    <Skeleton className="size-11 shrink-0 rounded-xl" />

                    <div className="min-w-0 flex-1">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="mt-2 h-3 w-1/3" />
                      <Skeleton className="mt-4 h-3 w-1/2" />
                    </div>
                  </div>
                ))
              ) : topJobs.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-muted">
                    <BriefcaseBusiness className="size-5 text-muted-foreground" />
                  </div>

                  <h3 className="mt-3 font-semibold">No matches yet</h3>

                  <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                    Complete your profile or refresh jobs to discover
                    opportunities.
                  </p>

                  <Link
                    href="/jobs"
                    className={`${buttonVariants({
                      size: "sm",
                    })} mt-4`}
                  >
                    Explore jobs
                  </Link>
                </div>
              ) : (
                topJobs.map((job) => (
                  <Link
                    href={`/jobs/${job.id}`}
                    key={job.id}
                    className="group flex gap-3.5 p-4 transition-colors hover:bg-muted/40 sm:gap-4 sm:p-5"
                  >
                    <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-muted/70 text-xs font-bold text-muted-foreground">
                      {initials(job.company_name)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="truncate text-sm font-semibold transition-colors group-hover:text-primary">
                            {job.title}
                          </h3>

                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {job.company_name}
                          </p>
                        </div>

                        <span className="w-fit shrink-0 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">
                          {job.match_score || 0}% match
                        </span>
                      </div>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span>{job.location || "Remote"}</span>

                        {formatSalary(job) && <span>{formatSalary(job)}</span>}
                      </div>
                    </div>

                    <ChevronRight className="mt-3 hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 sm:block" />
                  </Link>
                ))
              )}
            </div>

            <div className="border-t p-3 sm:hidden">
              <Link
                href="/jobs"
                className="flex items-center justify-center gap-1 py-2 text-xs font-semibold text-primary"
              >
                View all matches
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </section>

          {/* Application Pipeline */}
          <section className="surface overflow-hidden">
            <div className="border-b px-5 py-4 sm:px-6">
              <p className="section-label">Momentum</p>

              <h2 className="mt-1 text-base font-semibold">
                Application pipeline
              </h2>
            </div>

            <div className="p-5 sm:p-6">
              <div className="flex items-end justify-between">
                <div>
                  <p className="text-3xl font-bold tracking-tight">
                    {loading ? "—" : `${stats.responseRate}%`}
                  </p>

                  <p className="mt-1 text-xs text-muted-foreground">
                    response rate
                  </p>
                </div>

                <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10">
                  <TrendingUp className="size-5 text-emerald-500" />
                </div>
              </div>

              <div className="mt-5 h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{
                    width: `${Math.min(stats.responseRate, 100)}%`,
                  }}
                />
              </div>

              <div className="mt-6 space-y-3.5">
                {[
                  {
                    label: "Applied",
                    value: stats.applied,
                    tone: "bg-blue-500",
                  },
                  {
                    label: "Screening",
                    value: stats.screening,
                    tone: "bg-amber-500",
                  },
                  {
                    label: "Interview",
                    value: stats.interviews,
                    tone: "bg-violet-500",
                  },
                  {
                    label: "Offer",
                    value: stats.offers,
                    tone: "bg-emerald-500",
                  },
                ].map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <span className={`size-2 rounded-full ${item.tone}`} />

                    <span className="flex-1 text-sm text-muted-foreground">
                      {item.label}
                    </span>

                    <span className="text-sm font-semibold">
                      {loading ? "—" : item.value}
                    </span>
                  </div>
                ))}
              </div>

              <Link
                href="/applications"
                className="mt-6 flex items-center justify-between rounded-xl bg-muted/60 px-3.5 py-3 text-xs font-semibold transition-colors hover:bg-muted"
              >
                <span>Manage applications</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </section>
        </div>

        {/* Follow Ups + Activity */}
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          {/* Follow Ups */}
          <section className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
              <div>
                <p className="section-label">Stay proactive</p>

                <h2 className="mt-1 text-base font-semibold">
                  Upcoming follow-ups
                </h2>
              </div>

              <Link
                href="/applications"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Manage
              </Link>
            </div>

            {upcomingFollowUps.length === 0 ? (
              <div className="p-7 text-center">
                <div className="mx-auto grid size-10 place-items-center rounded-xl bg-muted">
                  <CalendarClock className="size-5 text-muted-foreground" />
                </div>

                <p className="mt-3 text-sm font-medium">
                  You&apos;re all clear
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  No follow-ups are scheduled right now.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {upcomingFollowUps.map((application) => {
                  const job = getApplicationJob(application);

                  if (!job) return null;

                  return (
                    <Link
                      key={application.id}
                      href="/applications"
                      className="flex items-center gap-3.5 p-4 transition-colors hover:bg-muted/40"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-500/10 text-amber-600">
                        <CalendarClock className="size-4" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {job.title}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {job.company_name}
                        </p>
                      </div>

                      <span className="shrink-0 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold">
                        {formatDate(application.follow_up_at)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>

          {/* Recent Activity */}
          <section className="surface overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-4 sm:px-6">
              <div>
                <p className="section-label">Latest changes</p>

                <h2 className="mt-1 text-base font-semibold">
                  Recent activity
                </h2>
              </div>

              <Link
                href="/applications"
                className="text-xs font-semibold text-primary hover:underline"
              >
                View all
              </Link>
            </div>

            {recentApplications.length === 0 ? (
              <div className="p-7 text-center">
                <div className="mx-auto grid size-10 place-items-center rounded-xl bg-muted">
                  <CheckCircle2 className="size-5 text-muted-foreground" />
                </div>

                <p className="mt-3 text-sm font-medium">
                  Your activity will appear here
                </p>

                <p className="mt-1 text-xs text-muted-foreground">
                  Save or apply to a job to start building your career timeline.
                </p>
              </div>
            ) : (
              <div className="divide-y">
                {recentApplications.map((application) => {
                  const job = getApplicationJob(application);

                  if (!job) return null;

                  return (
                    <Link
                      key={application.id}
                      href="/applications"
                      className="flex items-center gap-3.5 p-4 transition-colors hover:bg-muted/40"
                    >
                      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-xs font-bold text-muted-foreground">
                        {initials(job.company_name)}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">
                          {job.title}
                        </p>

                        <p className="mt-0.5 truncate text-xs text-muted-foreground">
                          {job.company_name}
                        </p>
                      </div>

                      <div className="shrink-0 text-right">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${statusTone[application.status]}`}
                        >
                          {statusLabels[application.status]}
                        </span>

                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {formatDate(application.updated_at)}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        {/* Quick Actions */}
        <section className="mt-6">
          <div className="mb-3">
            <p className="section-label">Career workspace</p>

            <h2 className="mt-1 text-base font-semibold">Quick actions</h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Link
              href="/resume"
              className="interactive-card group rounded-2xl border bg-card p-4 sm:p-5"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileText className="size-4" />
              </div>

              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Improve your resume</p>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Keep your career profile ready for every application.
                  </p>
                </div>

                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              href="/jobs"
              className="interactive-card group rounded-2xl border bg-card p-4 sm:p-5"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-300">
                <Sparkles className="size-4" />
              </div>

              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Prepare with AI</p>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Turn a strong job match into a focused preparation plan.
                  </p>
                </div>

                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>

            <Link
              href="/profile"
              className="interactive-card group rounded-2xl border bg-card p-4 sm:p-5"
            >
              <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                <CircleDollarSign className="size-4" />
              </div>

              <div className="mt-4 flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Tune preferences</p>

                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    Make future job matches more relevant to your goals.
                  </p>
                </div>

                <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
            </Link>
          </div>
        </section>

        {/* Product attribution */}
        <p className="mt-8 text-center text-[10px] leading-5 text-muted-foreground">
          JobPilot combines your profile, resume, preferences and application
          activity to guide your next career move.
        </p>
      </div>
    </main>
  );
}
