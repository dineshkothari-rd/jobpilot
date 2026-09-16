"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowUpRight, BriefcaseBusiness, CalendarClock, Check, CircleAlert,
  Columns3, Copy, ExternalLink, FileText, LayoutList, Loader2, Mail,
  MessageSquareText, RefreshCw, Search, SlidersHorizontal,
  Sparkles, Target, Trophy, X,
} from "lucide-react";
import Link from "next/link";
import {
  type ReactNode, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { buildFollowUpMessage } from "@/lib/applications/follow-up";
import { isApplicationAnswer, isApplicationPackage, type ApplicationAnswer, type ApplicationPackage } from "@/lib/applications/package";
import { cn, safeExternalUrl } from "@/lib/utils";
import { ApplicationWorkspace } from "./application-workspace";

const statusValues = [
  "saved", "applied", "screening", "interview", "offer", "rejected", "withdrawn",
] as const;
type ApplicationStatus = (typeof statusValues)[number];
type StatusFilter = "all" | ApplicationStatus;
type FollowUpFilter = "all" | "overdue" | "today" | "upcoming" | "none";
type SortOption = "newest" | "oldest" | "match" | "follow-up" | "alphabetical";
type ViewOption = "pipeline" | "list";

type MatchBreakdown = {
  role: number;
  skills: number;
  location: number;
  seniority: number;
  salary: number;
  country: number;
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
  skills: string[] | null;
};

type Resume = {
  id: string;
  file_name: string;
  is_primary: boolean;
};

type Application = {
  id: string;
  job_id: string;
  status: ApplicationStatus;
  applied_at: string | null;
  follow_up_at: string | null;
  notes: string | null;
  resume_id: string | null;
  created_at: string;
  updated_at: string;
  jobs: Job | Job[] | null;
  match_score: number | null;
  match_breakdown: MatchBreakdown | null;
  application_package: ApplicationPackage | null;
};

const statuses: { value: ApplicationStatus; label: string; description: string }[] = [
  { value: "saved", label: "Saved", description: "Considering" },
  { value: "applied", label: "Applied", description: "Submitted" },
  { value: "screening", label: "Screening", description: "In review" },
  { value: "interview", label: "Interview", description: "Meeting the team" },
  { value: "offer", label: "Offer", description: "Decision time" },
  { value: "rejected", label: "Rejected", description: "Closed" },
  { value: "withdrawn", label: "Withdrawn", description: "Closed by you" },
];

const statusStyles: Record<ApplicationStatus, { badge: string; dot: string }> = {
  saved: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  applied: { badge: "bg-blue-500/10 text-blue-700 dark:text-blue-300", dot: "bg-blue-500" },
  screening: { badge: "bg-amber-500/10 text-amber-700 dark:text-amber-300", dot: "bg-amber-500" },
  interview: { badge: "bg-violet-500/10 text-violet-700 dark:text-violet-300", dot: "bg-violet-500" },
  offer: { badge: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", dot: "bg-emerald-500" },
  rejected: { badge: "bg-red-500/10 text-red-700 dark:text-red-300", dot: "bg-red-500" },
  withdrawn: { badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
};

const inputClass = "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStatus(value: unknown): value is ApplicationStatus {
  return typeof value === "string" && statusValues.includes(value as ApplicationStatus);
}

function isApplication(value: unknown): value is Application {
  return isRecord(value) && typeof value.id === "string" && typeof value.job_id === "string" &&
    isStatus(value.status) && (value.match_score === null || typeof value.match_score === "number") &&
    (value.application_package === null || isApplicationPackage(value.application_package));
}

function isResume(value: unknown): value is Resume {
  return isRecord(value) && typeof value.id === "string" && typeof value.file_name === "string" &&
    typeof value.is_primary === "boolean";
}

function isApplicationUpdate(value: unknown): value is Omit<Application, "jobs" | "match_score" | "match_breakdown"> {
  return isRecord(value) && typeof value.id === "string" && typeof value.job_id === "string" && isStatus(value.status) &&
    ["applied_at", "follow_up_at", "notes", "resume_id"].every((key) => value[key] === null || typeof value[key] === "string") &&
    typeof value.created_at === "string" && typeof value.updated_at === "string";
}

function getJob(application: Application) {
  if (!application.jobs) return null;
  return Array.isArray(application.jobs) ? application.jobs[0] || null : application.jobs;
}

function labelForStatus(status: ApplicationStatus) {
  return statuses.find((item) => item.value === status)?.label || status;
}

function formatDate(value: string | null, short = false) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString("en-IN", short
    ? { day: "numeric", month: "short" }
    : { day: "numeric", month: "short", year: "numeric" });
}

function toDateInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString().slice(0, 10);
}

function dateAfter(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function dayStart(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
}

function followUpKind(value: string | null): Exclude<FollowUpFilter, "all"> {
  if (!value) return "none";
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return "none";
  const difference = dayStart(new Date(timestamp)) - dayStart();
  if (difference < 0) return "overdue";
  if (difference === 0) return "today";
  return "upcoming";
}

function followUpLabel(value: string | null) {
  const kind = followUpKind(value);
  if (kind === "none") return "No follow-up";
  if (kind === "today") return "Today";
  const days = Math.round((dayStart(new Date(value as string)) - dayStart()) / 86_400_000);
  return kind === "overdue" ? `${Math.abs(days)}d overdue` : `In ${days}d`;
}

function followUpTone(value: string | null) {
  const kind = followUpKind(value);
  if (kind === "overdue") return "bg-red-500/10 text-red-700 dark:text-red-300";
  if (kind === "today") return "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  if (kind === "upcoming") return "bg-blue-500/10 text-blue-700 dark:text-blue-300";
  return "bg-muted text-muted-foreground";
}

function formatSalary(job: Job) {
  if (job.salary_min == null && job.salary_max == null) return null;
  const code = job.salary_currency?.trim() || "";
  const prefix = code ? `${code} ` : "";
  const format = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  if (job.salary_min != null && job.salary_max != null) return `${prefix}${format(job.salary_min)} – ${format(job.salary_max)}`;
  if (job.salary_min != null) return `${prefix}${format(job.salary_min)}+`;
  return `Up to ${prefix}${format(job.salary_max as number)}`;
}

function initials(name: string | null | undefined) {
  return name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "JP";
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold", statusStyles[status].badge)}>
      <span className={cn("size-1.5 rounded-full", statusStyles[status].dot)} />
      {labelForStatus(status)}
    </span>
  );
}

function StatCard({ label, value, detail, icon }: {
  label: string;
  value: string | number;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <div className="surface rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-2 text-2xl font-bold tracking-tight">{value}</p></div>
        <span className="grid size-9 place-items-center rounded-xl bg-muted text-muted-foreground [&_svg]:size-4">{icon}</span>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">{detail}</p>
    </div>
  );
}

function Filters({ idPrefix, status, followUp, sort, onStatus, onFollowUp, onSort }: {
  idPrefix: string;
  status: StatusFilter;
  followUp: FollowUpFilter;
  sort: SortOption;
  onStatus: (value: StatusFilter) => void;
  onFollowUp: (value: FollowUpFilter) => void;
  onSort: (value: SortOption) => void;
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <label><span className="mb-1.5 block text-xs font-semibold">Status</span>
        <select id={`${idPrefix}-status`} value={status} onChange={(event) => onStatus(event.target.value as StatusFilter)} className={inputClass}>
          <option value="all">All statuses</option>
          {statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </label>
      <label><span className="mb-1.5 block text-xs font-semibold">Follow-up</span>
        <select id={`${idPrefix}-follow-up`} value={followUp} onChange={(event) => onFollowUp(event.target.value as FollowUpFilter)} className={inputClass}>
          <option value="all">Any follow-up</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="upcoming">Upcoming</option>
          <option value="none">No follow-up</option>
        </select>
      </label>
      <label><span className="mb-1.5 block text-xs font-semibold">Sort by</span>
        <select id={`${idPrefix}-sort`} value={sort} onChange={(event) => onSort(event.target.value as SortOption)} className={inputClass}>
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="match">Match score</option>
          <option value="follow-up">Follow-up date</option>
          <option value="alphabetical">Company / job title</option>
        </select>
      </label>
    </div>
  );
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [candidateName, setCandidateName] = useState<string | null>(null);
  const [candidateAnswers, setCandidateAnswers] = useState<ApplicationAnswer[]>([]);
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [followUpFilter, setFollowUpFilter] = useState<FollowUpFilter>("all");
  const [sort, setSort] = useState<SortOption>("newest");
  const [view, setView] = useState<ViewOption>("pipeline");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [followUpDraft, setFollowUpDraft] = useState("");
  const [resumeDraft, setResumeDraft] = useState("");
  const [updatingIds, setUpdatingIds] = useState<Set<string>>(new Set());
  const updateLocks = useRef(new Set<string>());
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);

  const loadData = useCallback(async () => {
    const requestId = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      setLoading(true);
      setError("");
      const response = await fetch("/api/applications", { cache: "no-store", signal: controller.signal });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string" ? result.error : "Unable to load applications.");
      }
      if (!isRecord(result) || !Array.isArray(result.applications) || !result.applications.every(isApplication) ||
        !Array.isArray(result.resumes) || !result.resumes.every(isResume) ||
        (result.candidate_name !== null && typeof result.candidate_name !== "string") ||
        !Array.isArray(result.candidate_answers) || !result.candidate_answers.every(isApplicationAnswer)) {
        throw new Error("The applications response was incomplete. Please retry.");
      }
      if (requestId !== requestRef.current) return;
      setApplications(result.applications);
      setResumes(result.resumes);
      setCandidateName(result.candidate_name);
      setCandidateAnswers(result.candidate_answers);
      const jobId = new URLSearchParams(window.location.search).get("jobId");
      const requested = result.applications.find((item) => item.job_id === jobId);
      if (requested) {
        setSelectedId(requested.id);
        setNotesDraft(requested.notes || "");
        setFollowUpDraft(toDateInput(requested.follow_up_at));
        setResumeDraft(requested.resume_id || "");
      }
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      console.error("APPLICATIONS LOAD ERROR:", loadError);
      if (requestId === requestRef.current) setError(loadError instanceof Error ? loadError.message : "Unable to load applications.");
    } finally {
      if (requestId === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadData(), 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadData]);

  const updateApplication = async (
    applicationId: string,
    changes: Record<string, string | null>,
    optimistic?: Partial<Application>,
  ) => {
    if (updateLocks.current.has(applicationId)) return false;
    const previous = applications.find((item) => item.id === applicationId);
    if (!previous) return false;
    updateLocks.current.add(applicationId);
    setUpdatingIds((current) => new Set(current).add(applicationId));
    setError("");
    setNotice("");
    if (optimistic) {
      setApplications((current) => current.map((item) => item.id === applicationId ? { ...item, ...optimistic } : item));
    }

    try {
      const response = await fetch("/api/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, ...changes }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(result) || !isApplicationUpdate(result.application)) {
        const message = isRecord(result) && typeof result.error === "string" ? result.error : "Unable to update application.";
        throw new Error(message);
      }
      const updated = result.application;
      if (selectedId === applicationId && "status" in changes) setFollowUpDraft(toDateInput(updated.follow_up_at));
      setApplications((current) => current.map((item) => item.id === applicationId
        ? { ...item, ...updated, jobs: item.jobs, match_score: item.match_score, match_breakdown: item.match_breakdown }
        : item));
      setNotice("Application updated.");
      return true;
    } catch (updateError) {
      console.error("APPLICATION UPDATE ERROR:", updateError);
      if (optimistic) setApplications((current) => current.map((item) => item.id === applicationId ? previous : item));
      setError(updateError instanceof Error ? updateError.message : "Unable to update application.");
      return false;
    } finally {
      updateLocks.current.delete(applicationId);
      setUpdatingIds((current) => {
        const next = new Set(current);
        next.delete(applicationId);
        return next;
      });
    }
  };

  const changeStatus = async (application: Application, status: ApplicationStatus) => {
    if (application.status === status) return;
    if (application.status === "saved" && ["applied", "screening", "interview", "offer"].includes(status) &&
      !window.confirm("Have you successfully submitted this application on the company website? Opening the link alone is not submission.")) return;
    const appliedAt = application.applied_at || (["applied", "screening", "interview", "offer"].includes(status)
      ? new Date().toISOString() : null);
    await updateApplication(application.id, { status }, {
      status,
      applied_at: appliedAt,
      updated_at: new Date().toISOString(),
    });
  };

  const openDetails = (application: Application) => {
    setSelectedId(application.id);
    setNotesDraft(application.notes || "");
    setFollowUpDraft(toDateInput(application.follow_up_at));
    setResumeDraft(application.resume_id || "");
  };

  const readyApplications = applications.filter((item) => item.status === "saved" && item.application_package?.status === "prepared")
    .sort((a, b) => (b.match_score ?? -1) - (a.match_score ?? -1));
  const confirmAndNext = async (application: Application) => {
    const changes: Record<string, string | null> = {
      status: "applied",
      notes: notesDraft.trim() || null,
      resumeId: resumeDraft || null,
    };
    if (followUpDraft !== toDateInput(application.follow_up_at)) {
      changes.followUpAt = followUpDraft ? new Date(`${followUpDraft}T09:00:00`).toISOString() : null;
    }
    const success = await updateApplication(application.id, changes);
    if (!success) return;
    const next = readyApplications.find((item) => item.id !== application.id);
    setNotice("Submission confirmed. Tracking and follow-up updated.");
    if (next) openDetails(next);
    else setSelectedId(null);
  };

  const saveDetails = async (applicationId: string) => {
    await updateApplication(applicationId, {
      notes: notesDraft.trim() || null,
      followUpAt: followUpDraft ? new Date(`${followUpDraft}T09:00:00`).toISOString() : null,
      resumeId: resumeDraft || null,
    });
  };

  const copyFollowUp = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice("Message copied.");
    } catch {
      setError("Copy failed. Select the message and copy it manually.");
    }
  };

  const selectedApplication = applications.find((item) => item.id === selectedId) || null;
  const counts = useMemo(() => Object.fromEntries(statusValues.map((status) => [
    status, applications.filter((item) => item.status === status).length,
  ])) as Record<ApplicationStatus, number>, [applications]);
  const activeCount = counts.saved + counts.applied + counts.screening + counts.interview;
  const dueCount = useMemo(() => applications.filter((item) => {
    const kind = followUpKind(item.follow_up_at);
    return kind === "overdue" || kind === "today";
  }).length, [applications]);

  const filteredApplications = useMemo(() => {
    const query = search.trim().toLowerCase();
    return applications.filter((application) => {
      const job = getJob(application);
      if (statusFilter !== "all" && application.status !== statusFilter) return false;
      if (followUpFilter !== "all" && followUpKind(application.follow_up_at) !== followUpFilter) return false;
      if (!query) return true;
      return [job?.title, job?.company_name, job?.location, application.notes, application.status]
        .filter(Boolean).join(" ").toLowerCase().includes(query);
    }).sort((a, b) => {
      const aJob = getJob(a);
      const bJob = getJob(b);
      if (sort === "oldest") return Date.parse(a.created_at) - Date.parse(b.created_at);
      if (sort === "match") return (b.match_score ?? -1) - (a.match_score ?? -1);
      if (sort === "follow-up") return (a.follow_up_at ? Date.parse(a.follow_up_at) : Infinity) - (b.follow_up_at ? Date.parse(b.follow_up_at) : Infinity);
      if (sort === "alphabetical") return `${aJob?.company_name || ""} ${aJob?.title || ""}`.localeCompare(`${bJob?.company_name || ""} ${bJob?.title || ""}`);
      return Date.parse(b.created_at) - Date.parse(a.created_at);
    });
  }, [applications, followUpFilter, search, sort, statusFilter]);

  const visibleStatuses = statusFilter === "all" ? statusValues : [statusFilter];
  const followUps = useMemo(() => applications.filter((item) => item.follow_up_at && !["offer", "rejected", "withdrawn"].includes(item.status))
    .sort((a, b) => Date.parse(a.follow_up_at as string) - Date.parse(b.follow_up_at as string)), [applications]);
  const hasFilters = Boolean(search || statusFilter !== "all" || followUpFilter !== "all" || sort !== "newest");
  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setFollowUpFilter("all");
    setSort("newest");
  };
  const filterProps = {
    status: statusFilter, followUp: followUpFilter, sort,
    onStatus: setStatusFilter, onFollowUp: setFollowUpFilter, onSort: setSort,
  };

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><BriefcaseBusiness className="size-3.5" /></span><p className="section-label">Career pipeline</p></div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-[34px]">Applications, without the busywork</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">Track every opportunity, keep follow-ups visible, and move from applied to offer with context intact.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={loading}><RefreshCw className={cn("size-4", loading && "animate-spin")} />Refresh</Button>
            <Link href="/jobs" className={buttonVariants({ size: "sm" })}><Search className="size-4" />Discover jobs</Link>
          </div>
        </header>

        {(error || notice) && (
          <div role={error ? "alert" : "status"} className={cn("mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm",
            error ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300")}>
            {error && <CircleAlert className="size-4 shrink-0" />}<span className="flex-1">{error || notice}</span>
            {error && <Button variant="outline" size="sm" onClick={() => void loadData()}>Retry</Button>}
            <button type="button" onClick={() => { setError(""); setNotice(""); }} className="grid size-8 place-items-center rounded-lg hover:bg-background/50" aria-label="Dismiss message"><X className="size-3.5" /></button>
          </div>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Application metrics">
          <StatCard label="Tracked opportunities" value={applications.length} detail="Saved roles are not submitted applications" icon={<BriefcaseBusiness />} />
          <StatCard label="Active pipeline" value={activeCount} detail="Saved through interview" icon={<Target />} />
          <StatCard label="Interviews" value={counts.interview} detail="Currently interviewing" icon={<MessageSquareText />} />
          <StatCard label="Offers" value={counts.offer} detail={dueCount ? `${dueCount} follow-up${dueCount === 1 ? "" : "s"} due` : "Recorded outcomes"} icon={<Trophy />} />
        </section>

        {!loading && readyApplications.length > 0 ? (
          <section className="mt-5 rounded-2xl border border-primary/20 bg-primary/5 p-5" aria-labelledby="ready-to-apply-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 id="ready-to-apply-title" className="font-bold">{readyApplications.length} ready to apply</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Resume and answers prepared. Review → apply → confirm. Best matches first.</p></div>
              <Button onClick={() => openDetails(readyApplications[0])}>Start next application<ArrowUpRight /></Button>
            </div>
            <details className="mt-4 text-xs">
              <summary className="cursor-pointer font-semibold">Choose a prepared application</summary>
              <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {readyApplications.map((application) => {
                  const job = getJob(application);
                  return <button key={application.id} type="button" onClick={() => openDetails(application)} className="min-h-16 rounded-xl border bg-background p-3 text-left hover:border-primary/40">
                    <span className="block font-semibold">{job?.title || "Job application"}</span>
                    <span className="mt-1 block text-muted-foreground">{job?.company_name || "Company"}{application.match_score !== null ? ` · ${application.match_score}% match` : ""}</span>
                  </button>;
                })}
              </div>
            </details>
          </section>
        ) : null}

        {!loading && applications.length > 0 && (
          <section className="mt-5 rounded-2xl border bg-card p-4 shadow-[var(--shadow-soft)]" aria-labelledby="follow-ups-heading">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-300"><CalendarClock className="size-4" /></span><div><h2 id="follow-ups-heading" className="text-sm font-bold">Follow-ups</h2><p className="text-xs text-muted-foreground">{followUps.length ? `${followUps.length} scheduled` : "Nothing scheduled yet"}</p></div></div>
              <button type="button" onClick={() => setFollowUpFilter(followUps.length ? "all" : "none")} className="text-xs font-semibold text-primary hover:underline">{followUps.length ? "View all" : "Find gaps"}</button>
            </div>
            {followUps.length ? (
              <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {followUps.slice(0, 3).map((application) => {
                  const job = getJob(application);
                  return <button key={application.id} type="button" onClick={() => openDetails(application)} className="interactive-card flex min-w-0 items-center gap-3 rounded-xl border bg-background p-3 text-left">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold">{initials(job?.company_name)}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold">{job?.title || "Job unavailable"}</span><span className="mt-0.5 block truncate text-[11px] text-muted-foreground">{job?.company_name || "Removed listing"}</span></span>
                    <span className={cn("shrink-0 rounded-lg px-2 py-1 text-[10px] font-semibold", followUpTone(application.follow_up_at))}>{followUpLabel(application.follow_up_at)}</span>
                  </button>;
                })}
              </div>
            ) : <p className="mt-4 rounded-xl border border-dashed bg-muted/20 p-4 text-xs text-muted-foreground">Open any application to add a follow-up date.</p>}
          </section>
        )}

        <section className="sticky top-0 z-20 mt-6 rounded-2xl border bg-background/90 p-3 shadow-sm backdrop-blur-xl sm:p-4" aria-label="Application controls">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search jobs, companies, locations or notes" aria-label="Search applications" className="h-11 w-full rounded-xl border bg-muted/30 pl-10 pr-9 text-sm outline-none focus:ring-2 focus:ring-ring/40" />{search && <button type="button" onClick={() => setSearch("")} className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted" aria-label="Clear search"><X className="size-3.5" /></button>}</div>
            <Dialog.Root open={filtersOpen} onOpenChange={setFiltersOpen}>
              <Dialog.Trigger className={`${buttonVariants({ variant: "outline", size: "icon" })} shrink-0 md:hidden`} aria-label="Open application filters"><SlidersHorizontal /></Dialog.Trigger>
              <Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-foreground/35 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" /><Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl border bg-background p-5 shadow-2xl transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full">
                <div className="mb-5 flex items-start justify-between"><div><Dialog.Title className="text-lg font-bold">Filter applications</Dialog.Title><Dialog.Description className="mt-1 text-xs text-muted-foreground">Focus the pipeline by stage and follow-up urgency.</Dialog.Description></div><Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Close filters"><X /></Dialog.Close></div>
                <Filters idPrefix="mobile" {...filterProps} />
                <div className="mt-6 grid grid-cols-2 gap-2"><Button variant="outline" onClick={clearFilters} disabled={!hasFilters}>Clear</Button><Dialog.Close className={buttonVariants()}>Show {filteredApplications.length}</Dialog.Close></div>
              </Dialog.Popup></Dialog.Portal>
            </Dialog.Root>
            <div className="flex shrink-0 rounded-xl border bg-background p-1" aria-label="Choose view">
              <button type="button" onClick={() => setView("pipeline")} aria-label="Pipeline view" aria-pressed={view === "pipeline"} className={cn("grid size-8 place-items-center rounded-lg", view === "pipeline" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}><Columns3 className="size-4" /></button>
              <button type="button" onClick={() => setView("list")} aria-label="List view" aria-pressed={view === "list"} className={cn("grid size-8 place-items-center rounded-lg", view === "list" ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted")}><LayoutList className="size-4" /></button>
            </div>
          </div>
          <div className="mt-4 hidden border-t pt-4 md:block"><Filters idPrefix="desktop" {...filterProps} /></div>
          <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs text-muted-foreground"><span aria-live="polite"><strong className="text-foreground">{loading ? "—" : filteredApplications.length}</strong> applications shown</span>{hasFilters && <button type="button" onClick={clearFilters} className="font-semibold text-primary hover:underline">Clear filters</button>}</div>
        </section>

        {loading ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, index) => <LoadingCard key={index} />)}</div>
        ) : error && applications.length === 0 ? (
          <EmptyState title="Applications unavailable" description="We couldn’t load your pipeline. Try again when your connection is ready." action={<Button onClick={() => void loadData()}>Try again</Button>} />
        ) : applications.length === 0 ? (
          <EmptyState title="Your pipeline is ready" description="Discover a role, apply, and confirm the application to start tracking it here." action={<Link href="/jobs" className={buttonVariants()}>Discover jobs</Link>} />
        ) : filteredApplications.length === 0 ? (
          <EmptyState title={followUpFilter !== "all" ? `No ${followUpFilter === "none" ? "missing" : followUpFilter} follow-ups` : "No applications match"} description="Try a different filter or return to the complete pipeline." action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
        ) : view === "pipeline" ? (
          <section className="mt-5 grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4" aria-label="Application pipeline">
            {visibleStatuses.map((status) => {
              const items = filteredApplications.filter((item) => item.status === status);
              const meta = statuses.find((item) => item.value === status);
              return <div key={status} className="min-w-0 rounded-2xl border bg-muted/25 p-3">
                <div className="flex items-center justify-between px-1 pb-3"><div className="flex items-center gap-2"><span className={cn("size-2 rounded-full", statusStyles[status].dot)} /><div><h2 className="text-xs font-bold">{meta?.label}</h2><p className="text-[10px] text-muted-foreground">{meta?.description}</p></div></div><span className="rounded-lg bg-background px-2 py-1 text-[10px] font-bold">{items.length}</span></div>
                <div className="space-y-2">{items.length ? items.map((application) => <PipelineCard key={application.id} application={application} updating={updatingIds.has(application.id)} onStatus={changeStatus} onOpen={openDetails} />) : <div className="rounded-xl border border-dashed bg-background/50 p-5 text-center"><p className="text-[11px] text-muted-foreground">No applications in this stage</p><Link href="/jobs" className="mt-2 inline-block text-[10px] font-semibold text-primary hover:underline">Discover jobs</Link></div>}</div>
              </div>;
            })}
          </section>
        ) : (
          <ListView applications={filteredApplications} updatingIds={updatingIds} onStatus={changeStatus} onOpen={openDetails} />
        )}

        <ApplicationDetails key={selectedId} application={selectedApplication} candidateName={candidateName} candidateAnswers={candidateAnswers} onConfirm={confirmAndNext} resumes={resumes} open={Boolean(selectedApplication)}
          updating={selectedApplication ? updatingIds.has(selectedApplication.id) : false}
          notes={notesDraft} followUp={followUpDraft} resumeId={resumeDraft}
          onOpenChange={(open) => { if (!open) setSelectedId(null); }} onNotes={setNotesDraft}
          onFollowUp={setFollowUpDraft} onResume={setResumeDraft} onSave={saveDetails} onStatus={changeStatus} onCopy={copyFollowUp} />
      </div>
    </main>
  );
}

function LoadingCard() {
  return <div className="surface animate-pulse rounded-2xl p-5"><div className="flex gap-3"><div className="size-10 rounded-xl bg-muted" /><div className="flex-1 space-y-2"><div className="h-4 w-2/3 rounded bg-muted" /><div className="h-3 w-1/3 rounded bg-muted" /></div></div><div className="mt-5 h-9 rounded-xl bg-muted" /></div>;
}

function EmptyState({ title, description, action }: { title: string; description: string; action: ReactNode }) {
  return <section className="surface mt-5 p-8 text-center sm:p-12"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"><BriefcaseBusiness className="size-6" /></div><h2 className="mt-5 text-xl font-bold">{title}</h2><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p><div className="mt-6 flex justify-center">{action}</div></section>;
}

function PipelineCard({ application, updating, onStatus, onOpen }: {
  application: Application;
  updating: boolean;
  onStatus: (application: Application, status: ApplicationStatus) => Promise<void>;
  onOpen: (application: Application) => void;
}) {
  const job = getJob(application);
  const salary = job ? formatSalary(job) : null;
  return <article className="rounded-xl border bg-card p-3 shadow-sm">
    <div className="flex items-start gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-bold">{initials(job?.company_name)}</span><div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-xs font-bold leading-4">{job?.title || "Job no longer available"}</h3><p className="mt-1 truncate text-[10px] text-muted-foreground">{job?.company_name || "Removed listing"}</p></div>{typeof application.match_score === "number" && <span className="shrink-0 text-[11px] font-bold text-primary">{application.match_score}%</span>}</div>
    <div className="mt-3 space-y-1 text-[10px] text-muted-foreground"><p className="truncate">{job?.location || "Location not listed"}{salary ? ` · ${salary}` : ""}</p><p className="truncate capitalize">{job?.source || "Source unavailable"} · Applied {formatDate(application.applied_at, true)}</p></div>
    <div className="mt-3 flex items-center justify-between gap-2"><span className={cn("rounded-lg px-2 py-1 text-[9px] font-semibold", followUpTone(application.follow_up_at))}>{followUpLabel(application.follow_up_at)}</span><button type="button" onClick={() => onOpen(application)} className="min-h-8 text-[10px] font-semibold text-primary hover:underline">Details</button></div>
    <select value={application.status} disabled={updating} onChange={(event) => void onStatus(application, event.target.value as ApplicationStatus)} aria-label={`Change status for ${job?.title || "application"}`} className="mt-3 h-8 w-full rounded-lg border bg-background px-2 text-[10px] font-semibold outline-none focus:ring-2 focus:ring-ring/40">{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>
  </article>;
}

function ListView({ applications, updatingIds, onStatus, onOpen }: {
  applications: Application[];
  updatingIds: Set<string>;
  onStatus: (application: Application, status: ApplicationStatus) => Promise<void>;
  onOpen: (application: Application) => void;
}) {
  return <section className="mt-5" aria-label="Application list">
    <div className="space-y-3 md:hidden">{applications.map((application) => <MobileListCard key={application.id} application={application} updating={updatingIds.has(application.id)} onStatus={onStatus} onOpen={onOpen} />)}</div>
    <div className="hidden overflow-hidden rounded-2xl border bg-card shadow-[var(--shadow-soft)] md:block"><div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left"><thead className="border-b bg-muted/35 text-[10px] uppercase tracking-[0.08em] text-muted-foreground"><tr><th className="px-4 py-3 font-bold">Opportunity</th><th className="px-4 py-3 font-bold">Match</th><th className="px-4 py-3 font-bold">Stage</th><th className="px-4 py-3 font-bold">Applied</th><th className="px-4 py-3 font-bold">Follow-up</th><th className="px-4 py-3 text-right font-bold">Action</th></tr></thead><tbody className="divide-y">{applications.map((application) => {
      const job = getJob(application);
      const salary = job ? formatSalary(job) : null;
      return <tr key={application.id} className="hover:bg-muted/20"><td className="px-4 py-3"><div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-bold">{initials(job?.company_name)}</span><div className="min-w-0"><p className="max-w-[280px] truncate text-xs font-bold">{job?.title || "Job no longer available"}</p><p className="mt-0.5 max-w-[280px] truncate text-[11px] text-muted-foreground">{job?.company_name || "Removed listing"}{job?.location ? ` · ${job.location}` : ""}</p><p className="mt-0.5 max-w-[280px] truncate text-[10px] capitalize text-muted-foreground">{job?.source || "Source unavailable"}{salary ? ` · ${salary}` : ""}</p></div></div></td><td className="px-4 py-3 text-xs font-bold text-primary">{typeof application.match_score === "number" ? `${application.match_score}%` : "—"}</td><td className="px-4 py-3"><select value={application.status} disabled={updatingIds.has(application.id)} onChange={(event) => void onStatus(application, event.target.value as ApplicationStatus)} aria-label={`Change status for ${job?.title || "application"}`} className="h-8 rounded-lg border bg-background px-2 text-[10px] font-semibold">{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></td><td className="px-4 py-3 text-[11px] text-muted-foreground">{formatDate(application.applied_at, true)}</td><td className="px-4 py-3"><span className={cn("rounded-lg px-2 py-1 text-[10px] font-semibold", followUpTone(application.follow_up_at))}>{followUpLabel(application.follow_up_at)}</span></td><td className="px-4 py-3 text-right"><Button variant="ghost" size="sm" onClick={() => onOpen(application)}>Details</Button></td></tr>;
    })}</tbody></table></div></div>
  </section>;
}

function MobileListCard(props: Parameters<typeof PipelineCard>[0]) {
  const { application, updating, onStatus, onOpen } = props;
  const job = getJob(application);
  const salary = job ? formatSalary(job) : null;
  return <article className="surface rounded-2xl p-4"><div className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-xs font-bold">{initials(job?.company_name)}</span><div className="min-w-0 flex-1"><h3 className="line-clamp-2 text-sm font-bold">{job?.title || "Job no longer available"}</h3><p className="mt-1 truncate text-xs text-muted-foreground">{job?.company_name || "Removed listing"}</p></div>{typeof application.match_score === "number" && <span className="text-xs font-bold text-primary">{application.match_score}%</span>}</div><div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">{job?.location && <span>{job.location}</span>}{salary && <span>• {salary}</span>}<span className="capitalize">• {job?.source || "Source unavailable"}</span><span>• Applied {formatDate(application.applied_at, true)}</span><span className={cn("rounded-lg px-2 py-1 font-semibold", followUpTone(application.follow_up_at))}>{followUpLabel(application.follow_up_at)}</span></div><div className="mt-4 grid grid-cols-[1fr_auto] gap-2"><select value={application.status} disabled={updating} onChange={(event) => void onStatus(application, event.target.value as ApplicationStatus)} aria-label={`Change status for ${job?.title || "application"}`} className={inputClass}>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><Button variant="outline" onClick={() => onOpen(application)}>Details</Button></div></article>;
}

function ApplicationDetails({ application, candidateName, candidateAnswers, onConfirm, resumes, open, updating, notes, followUp, resumeId, onOpenChange, onNotes, onFollowUp, onResume, onSave, onStatus, onCopy }: {
  application: Application | null;
  candidateName: string | null;
  candidateAnswers: ApplicationAnswer[];
  onConfirm: (application: Application) => Promise<void>;
  resumes: Resume[];
  open: boolean;
  updating: boolean;
  notes: string;
  followUp: string;
  resumeId: string;
  onOpenChange: (open: boolean) => void;
  onNotes: (value: string) => void;
  onFollowUp: (value: string) => void;
  onResume: (value: string) => void;
  onSave: (id: string) => Promise<void>;
  onStatus: (application: Application, status: ApplicationStatus) => Promise<void>;
  onCopy: (value: string) => Promise<void>;
}) {
  if (!application) return null;
  const job = getJob(application);
  const salary = job ? formatSalary(job) : null;
  const applicationUrl = safeExternalUrl(job?.application_url || null);
  const resume = resumes.find((item) => item.id === application.resume_id);
  const message = buildFollowUpMessage({
    status: application.status,
    title: job?.title || null,
    company: job?.company_name || null,
    candidateName,
  });
  const mailto = `mailto:?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`;
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-foreground/35 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" /><Dialog.Popup className={cn("fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border bg-background shadow-2xl transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full md:inset-y-0 md:left-auto md:right-0 md:rounded-none md:translate-x-0 md:data-ending-style:translate-x-full md:data-ending-style:translate-y-0 md:data-starting-style:translate-x-full md:data-starting-style:translate-y-0", application.status === "saved" && application.application_package?.status === "prepared" ? "md:w-[min(800px,100vw)]" : "md:w-[min(520px,100vw)]")}>
    <div className="flex items-start justify-between gap-4 border-b p-5"><div className="flex min-w-0 gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-muted text-xs font-bold">{initials(job?.company_name)}</span><div className="min-w-0"><Dialog.Title className="line-clamp-2 text-lg font-bold">{job?.title || "Job no longer available"}</Dialog.Title><Dialog.Description className="mt-1 truncate text-xs text-muted-foreground">{job?.company_name || "The linked job was removed"}</Dialog.Description></div></div><Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Close application details"><X /></Dialog.Close></div>
    <div className="flex-1 overflow-y-auto p-5">
      <div className="flex flex-wrap items-center gap-2"><StatusBadge status={application.status} />{typeof application.match_score === "number" && <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary"><Target className="size-3" />{application.match_score}% match</span>}<span className={cn("rounded-full px-2.5 py-1 text-[10px] font-bold", followUpTone(application.follow_up_at))}>{followUpLabel(application.follow_up_at)}</span></div>
      {application.status === "saved" && application.application_package?.status === "prepared" ? (
        <ApplicationWorkspace applicationPackage={application.application_package} candidateAnswers={candidateAnswers} updating={updating} onConfirm={() => onConfirm(application)} />
      ) : null}
      <dl className="mt-5 grid grid-cols-2 gap-3 text-xs"><DetailItem label="Location" value={job?.location || "Not listed"} /><DetailItem label="Salary" value={salary || "Not listed"} /><DetailItem label="Source" value={job?.source || "Not available"} /><DetailItem label="Resume used" value={resume?.file_name || (application.resume_id ? "Resume unavailable" : "Not selected")} /></dl>
      <label className="mt-5 block"><span className="mb-1.5 block text-xs font-semibold">Status</span><select value={application.status} disabled={updating} onChange={(event) => void onStatus(application, event.target.value as ApplicationStatus)} className={inputClass}>{statuses.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>

      {application.match_breakdown && <section className="mt-6 rounded-2xl border bg-muted/25 p-4"><h3 className="text-sm font-bold">Match breakdown</h3><div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><Breakdown label="Role" value={application.match_breakdown.role} max={30} /><Breakdown label="Skills" value={application.match_breakdown.skills} max={30} /><Breakdown label="Location" value={application.match_breakdown.location} max={15} /><Breakdown label="Experience" value={application.match_breakdown.seniority} max={10} /><Breakdown label="Salary" value={application.match_breakdown.salary} max={10} /><Breakdown label="Country" value={application.match_breakdown.country} max={5} /></div></section>}

      <section className="mt-6 rounded-2xl border bg-muted/25 p-4"><div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold">Follow-up assistant</h3><p className="mt-1 text-[11px] text-muted-foreground">Stage-aware draft using only this application’s recorded context.</p></div><Mail className="size-4 text-primary" /></div><p className="mt-4 text-xs font-bold">{message.subject}</p><p className="mt-2 whitespace-pre-wrap rounded-xl border bg-background p-3 text-xs leading-5 text-muted-foreground">{message.body}</p><div className="mt-3 grid grid-cols-2 gap-2"><Button variant="outline" size="sm" onClick={() => void onCopy(`${message.subject}\n\n${message.body}`)}><Copy />Copy</Button><a href={mailto} className={buttonVariants({ size: "sm" })}><Mail />Open email</a></div><div className="mt-4 border-t pt-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Quick reminder</p><div className="mt-2 flex flex-wrap gap-2"><Button type="button" variant="outline" size="sm" onClick={() => onFollowUp(dateAfter(3))}>In 3 days</Button><Button type="button" variant="outline" size="sm" onClick={() => onFollowUp(dateAfter(7))}>In 7 days</Button>{followUp && <Button type="button" variant="ghost" size="sm" onClick={() => onFollowUp("")}>Clear</Button>}</div><p className="mt-2 text-[10px] text-muted-foreground">Save details below to apply the reminder.</p></div></section>

      <section className="mt-6"><h3 className="text-sm font-bold">Application details</h3><div className="mt-3 space-y-4"><label className="block"><span className="mb-1.5 block text-xs font-semibold">Follow-up date</span><input type="date" value={followUp} onChange={(event) => onFollowUp(event.target.value)} className={inputClass} /></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Resume used</span><select value={resumeId} onChange={(event) => onResume(event.target.value)} className={inputClass}><option value="">No resume selected</option>{resumes.map((item) => <option key={item.id} value={item.id}>{item.file_name}{item.is_primary ? " • Primary" : ""}</option>)}</select></label><label className="block"><span className="mb-1.5 block text-xs font-semibold">Notes</span><textarea value={notes} onChange={(event) => onNotes(event.target.value)} rows={5} placeholder="Recruiter details, interview notes, decisions…" className="w-full resize-y rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40" /></label><Button onClick={() => void onSave(application.id)} disabled={updating} className="w-full">{updating ? <Loader2 className="animate-spin" /> : <Check />}Save details</Button></div></section>

      <section className="mt-6"><h3 className="text-sm font-bold">Activity</h3><div className="mt-3 space-y-3 border-l pl-4"><TimelineItem label="Added to pipeline" value={formatDate(application.created_at)} /><TimelineItem label="Application date" value={formatDate(application.applied_at)} />{application.updated_at !== application.created_at && <TimelineItem label="Last updated" value={formatDate(application.updated_at)} />}</div><p className="mt-3 text-[10px] text-muted-foreground">Only recorded application timestamps are shown; status history is not stored.</p></section>

      {job && <section className="mt-6"><h3 className="text-sm font-bold">Career tools</h3><div className="mt-3 grid grid-cols-2 gap-2"><Link href={`/jobs/${job.id}/prepare`} className={buttonVariants({ variant: "outline", size: "sm" })}><Sparkles />AI preparation</Link><Link href={`/jobs/${job.id}/copilot`} className={buttonVariants({ variant: "outline", size: "sm" })}><FileText />Copilot</Link><Link href={`/jobs/${job.id}/interview`} className={buttonVariants({ variant: "outline", size: "sm" })}><MessageSquareText />Interview studio</Link><Link href={`/jobs/${job.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>View job<ArrowUpRight /></Link>{applicationUrl && <a href={applicationUrl} target="_blank" rel="noreferrer" className={`${buttonVariants({ size: "sm" })} col-span-2`}>Open application<ExternalLink /></a>}</div></section>}
    </div>
  </Dialog.Popup></Dialog.Portal></Dialog.Root>;
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border bg-muted/25 p-3"><dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 truncate font-semibold" title={value}>{value}</dd></div>;
}

function Breakdown({ label, value, max }: { label: string; value: number; max: number }) {
  const percent = Math.min(100, Math.max(0, value / max * 100));
  return <div><div className="flex justify-between text-[10px]"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}/{max}</span></div><div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div></div>;
}

function TimelineItem({ label, value }: { label: string; value: string }) {
  return <div className="relative"><span className="absolute -left-[21px] top-1 size-2 rounded-full bg-primary ring-4 ring-background" /><p className="text-xs font-semibold">{label}</p><p className="mt-0.5 text-[11px] text-muted-foreground">{value}</p></div>;
}
