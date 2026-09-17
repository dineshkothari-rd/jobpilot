"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowUpRight, BriefcaseBusiness, Check, ChevronDown, Clock3,
  ExternalLink, Filter, Heart, Loader2, MapPin, RefreshCw,
  Search, SlidersHorizontal, Sparkles, X,
} from "lucide-react";
import Link from "next/link";
import {
  type ReactNode, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { safeExternalUrl } from "@/lib/utils";

type MatchBreakdown = {
  role?: number;
  skills?: number;
  location?: number;
  seniority?: number;
  salary?: number;
  country?: number;
};

type Job = {
  id: string;
  external_id?: string;
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
  match_score: number;
  match_breakdown?: MatchBreakdown;
};

type SortOption = "match" | "recent" | "salary";
type RemoteFilter = "all" | "remote" | "onsite";

const fieldClass =
  "h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none transition focus:ring-2 focus:ring-ring/40";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isJob(value: unknown): value is Job {
  if (!isRecord(value) || typeof value.id !== "string" ||
    typeof value.match_score !== "number" || !Number.isFinite(value.match_score) ||
    value.match_score < 0 || value.match_score > 100) return false;

  const nullableStrings = [
    "title", "company_name", "description", "location", "country",
    "employment_type", "seniority", "salary_currency", "application_url",
    "source_url", "source", "published_at",
  ];
  const nullableNumbers = ["salary_min", "salary_max"];
  const breakdownKeys: (keyof MatchBreakdown)[] = [
    "role", "skills", "location", "seniority", "salary", "country",
  ];
  if (!isRecord(value.match_breakdown)) return false;
  const breakdown = value.match_breakdown;

  return nullableStrings.every((key) => value[key] == null || typeof value[key] === "string") &&
    nullableNumbers.every((key) => value[key] == null || typeof value[key] === "number") &&
    (value.external_id == null || typeof value.external_id === "string") &&
    (value.skills == null || (Array.isArray(value.skills) && value.skills.every((skill) => typeof skill === "string"))) &&
    breakdownKeys.every((key) =>
      typeof breakdown[key] === "number" && Number.isFinite(breakdown[key]));
}

function errorMessage(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function normalizeScore(value: unknown, fallback = 70) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : fallback;
}

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function isRemoteJob(job: Job) {
  return /remote|worldwide|work from home|distributed/.test(
    normalize([job.location, job.description, ...(job.skills || [])].filter(Boolean).join(" ")),
  );
}

function formatSalary(job: Job) {
  if (job.salary_min == null && job.salary_max == null) return null;
  const currency = job.salary_currency?.trim() || "";
  const format = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  const prefix = currency ? `${currency} ` : "";
  if (job.salary_min != null && job.salary_max != null) {
    return `${prefix}${format(job.salary_min)} – ${format(job.salary_max)}`;
  }
  if (job.salary_min != null) return `${prefix}${format(job.salary_min)}+`;
  return `Up to ${prefix}${format(job.salary_max as number)}`;
}

function formatPublished(value: string | null) {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  const days = Math.round((timestamp - Date.now()) / 86_400_000);
  if (days === 0) return "Today";
  if (days === -1) return "Yesterday";
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(days) < 30) return formatter.format(days, "day");
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) return formatter.format(months, "month");
  return new Date(value).toLocaleDateString("en", { month: "short", year: "numeric" });
}

function scoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Good";
  return "Potential";
}

function scoreTone(score: number) {
  if (score >= 85) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 70) return "text-primary";
  if (score >= 55) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function initials(name: string | null) {
  return name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "JP";
}

function strongestSignals(job: Job, resumeSkills: string[]) {
  const jobText = normalize(
    [job.title, job.description, ...(job.skills || [])].filter(Boolean).join(" "),
  );
  const skills = resumeSkills.filter((skill) => {
    const term = normalize(skill);
    return term.length > 1 && jobText.includes(term);
  }).slice(0, 3);
  const maxima: Record<keyof MatchBreakdown, number> = {
    role: 30, skills: 30, location: 15, seniority: 10, salary: 10, country: 5,
  };
  const labels: Record<keyof MatchBreakdown, string> = {
    role: "Role alignment", skills: "Skills alignment", location: "Location fit",
    seniority: "Experience fit", salary: "Salary fit", country: "Country fit",
  };
  const breakdownSignals = Object.entries(job.match_breakdown || {})
    .filter((entry): entry is [keyof MatchBreakdown, number] =>
      typeof entry[1] === "number" && entry[1] > 0)
    .sort(([a, aValue], [b, bValue]) => bValue / maxima[b] - aValue / maxima[a])
    .map(([key]) => labels[key]);
  return Array.from(new Set([...skills, ...breakdownSignals])).slice(0, 4);
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border bg-card p-5">
      <div className="flex gap-3">
        <div className="size-11 animate-pulse rounded-xl bg-muted" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
          <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
        </div>
        <div className="size-10 animate-pulse rounded-full bg-muted" />
      </div>
      <div className="mt-5 flex gap-2">
        <div className="h-7 w-24 animate-pulse rounded-lg bg-muted" />
        <div className="h-7 w-20 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="mt-5 h-10 animate-pulse rounded-xl bg-muted" />
    </div>
  );
}

type FilterFieldsProps = {
  idPrefix: string;
  minimumScore: number;
  profileMinimum: number;
  location: string;
  locations: string[];
  remote: RemoteFilter;
  employmentType: string;
  employmentTypes: string[];
  sort: SortOption;
  onMinimumScore: (value: number) => void;
  onLocation: (value: string) => void;
  onRemote: (value: RemoteFilter) => void;
  onEmploymentType: (value: string) => void;
  onSort: (value: SortOption) => void;
};

function FilterFields(props: FilterFieldsProps) {
  const {
    idPrefix, minimumScore, profileMinimum, location, locations, remote,
    employmentType, employmentTypes, sort, onMinimumScore, onLocation,
    onRemote, onEmploymentType, onSort,
  } = props;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
      <label className="block">
        <span className="mb-1.5 flex items-center justify-between text-xs font-semibold">
          Minimum match
          <output htmlFor={`${idPrefix}-score`} className="text-primary">{minimumScore}%+</output>
        </span>
        <input id={`${idPrefix}-score`} type="range" min={profileMinimum} max="100" step="1"
          value={minimumScore}
          onChange={(event) => onMinimumScore(normalizeScore(event.target.value, profileMinimum))}
          className="h-10 w-full cursor-pointer accent-primary" />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Location</span>
        <select value={location} onChange={(event) => onLocation(event.target.value)} className={fieldClass}>
          <option value="all">All locations</option>
          {locations.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Workplace</span>
        <select value={remote} onChange={(event) => onRemote(event.target.value as RemoteFilter)} className={fieldClass}>
          <option value="all">Remote &amp; on-site</option>
          <option value="remote">Remote only</option>
          <option value="onsite">On-site only</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Employment type</span>
        <select value={employmentType} onChange={(event) => onEmploymentType(event.target.value)} className={fieldClass}>
          <option value="all">All types</option>
          {employmentTypes.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Sort by</span>
        <select value={sort} onChange={(event) => onSort(event.target.value as SortOption)} className={fieldClass}>
          <option value="match">Best match</option>
          <option value="recent">Most recent</option>
          <option value="salary">Highest salary</option>
        </select>
      </label>
    </div>
  );
}

export default function JobsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [applications, setApplications] = useState<Map<string, string>>(new Map());
  const [profileMinimum, setProfileMinimum] = useState(70);
  const [minimumScore, setMinimumScore] = useState(70);
  const [totalScoredJobs, setTotalScoredJobs] = useState(0);
  const [hasResume, setHasResume] = useState(true);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("all");
  const [remote, setRemote] = useState<RemoteFilter>("all");
  const [employmentType, setEmploymentType] = useState("all");
  const [sort, setSort] = useState<SortOption>("match");
  const [showFilters, setShowFilters] = useState(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const syncLock = useRef(false);
  const saveLocks = useRef(new Set<string>());

  const loadJobs = useCallback(async (background = false) => {
    const requestId = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (!background) setLoading(true);
      setError("");
      setSetupCode("");
      const supabase = createClient();
      const [response, authResult] = await Promise.all([
        fetch("/api/jobs/match", { cache: "no-store", signal: controller.signal }),
        supabase.auth.getUser(),
      ]);
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (isRecord(result) && typeof result.code === "string") setSetupCode(result.code);
        throw new Error(errorMessage(result, "Unable to load recommendations."));
      }
      if (!isRecord(result) || !Array.isArray(result.jobs) || !result.jobs.every(isJob)) {
        throw new Error("The recommendations response was incomplete. Please retry.");
      }
      if (authResult.error) throw new Error(authResult.error.message);

      const user = authResult.data.user;
      let nextSavedIds = new Set<string>();
      const nextApplications = new Map<string, string>();
      if (user) {
        const [savedResult, applicationResult] = await Promise.all([
          supabase.from("saved_jobs").select("job_id").eq("user_id", user.id),
          supabase.from("applications").select("job_id,status").eq("user_id", user.id),
        ]);
        if (savedResult.error) throw new Error(savedResult.error.message);
        if (applicationResult.error) throw new Error(applicationResult.error.message);
        nextSavedIds = new Set(
          (savedResult.data || []).map((item) => item.job_id)
            .filter((id): id is string => typeof id === "string"),
        );
        for (const item of applicationResult.data || []) {
          if (typeof item.job_id === "string" && typeof item.status === "string" && !nextApplications.has(item.job_id)) {
            nextApplications.set(item.job_id, item.status);
          }
        }
      }
      if (requestId !== requestRef.current) return false;

      const uniqueJobs = Array.from(new Map(
        result.jobs.map((job) => [job.external_id || job.id, job]),
      ).values());
      const threshold = normalizeScore(result.minimum_match_score);
      setJobs(uniqueJobs);
      setResumeSkills(Array.isArray(result.resume_skills)
        ? result.resume_skills.filter((skill): skill is string => typeof skill === "string") : []);
      setSavedIds(nextSavedIds);
      setApplications(nextApplications);
      setProfileMinimum(threshold);
      setMinimumScore((current) => Math.max(threshold, current === 70 ? threshold : current));
      setTotalScoredJobs(typeof result.total_scored_jobs === "number" ? result.total_scored_jobs : uniqueJobs.length);
      setHasResume(result.has_resume !== false);
      return true;
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return false;
      console.error("JOBS LOAD ERROR:", loadError);
      if (requestId === requestRef.current) {
        setError(loadError instanceof Error ? loadError.message : "Unable to load recommendations.");
      }
      return false;
    } finally {
      if (!background && requestId === requestRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadJobs(), 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadJobs]);

  const syncJobs = async () => {
    if (syncLock.current || loading) return;
    syncLock.current = true;
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/jobs/sync", { method: "POST" });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(result, "Unable to refresh jobs."));
      if (await loadJobs(true)) setNotice("Your recommendations are up to date.");
    } catch (syncError) {
      console.error("JOBS SYNC ERROR:", syncError);
      setError(syncError instanceof Error ? syncError.message : "Unable to refresh jobs.");
    } finally {
      syncLock.current = false;
      setSyncing(false);
    }
  };

  const toggleSave = async (jobId: string) => {
    if (saveLocks.current.has(jobId)) return;
    saveLocks.current.add(jobId);
    const wasSaved = savedIds.has(jobId);
    setSavingIds((current) => new Set(current).add(jobId));
    setSavedIds((current) => {
      const next = new Set(current);
      if (wasSaved) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
    try {
      const response = await fetch("/api/jobs/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId, action: wasSaved ? "remove" : "save" }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(result) || typeof result.saved !== "boolean") {
        throw new Error(errorMessage(result, "Unable to update this saved job."));
      }
      setSavedIds((current) => {
        const next = new Set(current);
        if (result.saved) next.add(jobId);
        else next.delete(jobId);
        return next;
      });
    } catch (saveError) {
      setSavedIds((current) => {
        const next = new Set(current);
        if (wasSaved) next.add(jobId);
        else next.delete(jobId);
        return next;
      });
      setError(saveError instanceof Error ? saveError.message : "Unable to update this saved job.");
    } finally {
      saveLocks.current.delete(jobId);
      setSavingIds((current) => {
        const next = new Set(current);
        next.delete(jobId);
        return next;
      });
    }
  };

  const locations = useMemo(() => Array.from(new Set(
    jobs.map((job) => job.location?.trim()).filter((item): item is string => Boolean(item)),
  )).sort(), [jobs]);
  const employmentTypes = useMemo(() => Array.from(new Set(
    jobs.map((job) => job.employment_type?.trim()).filter((item): item is string => Boolean(item)),
  )).sort(), [jobs]);

  const filteredJobs = useMemo(() => {
    const query = normalize(search);
    return jobs.filter((job) => {
      if (job.match_score < minimumScore) return false;
      if (location !== "all" && job.location !== location) return false;
      if (remote !== "all" && isRemoteJob(job) !== (remote === "remote")) return false;
      if (employmentType !== "all" && job.employment_type !== employmentType) return false;
      if (!query) return true;
      return normalize([
        job.title, job.company_name, job.location, job.country, job.description,
        job.employment_type, job.seniority, ...(job.skills || []),
      ].filter(Boolean).join(" ")).includes(query);
    }).sort((a, b) => {
      if (sort === "recent") return (Date.parse(b.published_at || "") || 0) - (Date.parse(a.published_at || "") || 0);
      if (sort === "salary") return (b.salary_max ?? b.salary_min ?? -1) - (a.salary_max ?? a.salary_min ?? -1);
      return b.match_score - a.match_score;
    });
  }, [employmentType, jobs, location, minimumScore, remote, search, sort]);

  const highMatches = useMemo(() => jobs.filter((job) => job.match_score >= 80).length, [jobs]);
  const averageMatch = useMemo(() => jobs.length
    ? Math.round(jobs.reduce((sum, job) => sum + job.match_score, 0) / jobs.length) : 0, [jobs]);
  const hasUserFilters = Boolean(
    search || minimumScore > profileMinimum || location !== "all" ||
    remote !== "all" || employmentType !== "all" || sort !== "match",
  );

  const clearFilters = () => {
    setSearch("");
    setMinimumScore(profileMinimum);
    setLocation("all");
    setRemote("all");
    setEmploymentType("all");
    setSort("match");
  };

  const filterProps: Omit<FilterFieldsProps, "idPrefix"> = {
    minimumScore, profileMinimum, location, locations, remote, employmentType,
    employmentTypes, sort, onMinimumScore: setMinimumScore, onLocation: setLocation,
    onRemote: setRemote, onEmploymentType: setEmploymentType, onSort: setSort,
  };

  return (
    <main className="min-h-screen pb-24 md:pb-8">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <header className="animate-float-in flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary"><Sparkles className="size-3.5" /></span>
              <p className="section-label">Find jobs</p>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-[34px]">Find your next job</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              Best matches first. Open a role to review it, or save it to your shortlist. A match score is a guide, not a hiring guarantee.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void syncJobs()} disabled={syncing || loading}>
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Refreshing…" : "Refresh jobs"}
            </Button>
            <Link href="/saved-jobs" className={buttonVariants({ size: "sm", variant: "secondary" })}>
              <Heart className="size-4" /> Saved
            </Link>
          </div>
        </header>

        <section className="ai-surface interactive-card mt-6 rounded-2xl border p-4 sm:p-5" aria-label="Opportunity summary">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <span className="hidden size-10 place-items-center rounded-xl bg-primary/10 text-primary sm:grid"><Sparkles className="size-4" /></span>
              <div>
                <p className="text-sm font-semibold">Your opportunity snapshot</p>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  {loading ? "Calculating your matches…" : `${highMatches} high-confidence matches from ${totalScoredJobs} scored jobs.`}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MiniMetric label="Recommended" value={loading ? "—" : jobs.length} />
              <MiniMetric label="80%+" value={loading ? "—" : highMatches} />
              <MiniMetric label="Average" value={loading ? "—" : `${averageMatch}%`} />
            </div>
          </div>
        </section>

        {!hasResume && !loading && !error && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl border bg-muted/35 px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <span>Add a resume to unlock skill-based matching; current results use your profile and preferences.</span>
            <Link href="/resume" className="font-semibold text-primary hover:underline">Add resume</Link>
          </div>
        )}

        <section className="sticky top-0 z-20 mt-5 rounded-2xl border bg-background/90 p-3 shadow-sm backdrop-blur-xl sm:p-4" aria-label="Search and filters">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={search} onChange={(event) => setSearch(event.target.value)}
                placeholder="Search roles, companies, locations or skills" aria-label="Search jobs"
                className="h-11 w-full rounded-xl border bg-muted/30 pl-10 pr-9 text-sm outline-none transition focus:bg-background focus:ring-2 focus:ring-ring/40" />
              {search && <button type="button" onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"><X className="size-3.5" /></button>}
            </div>

            <Dialog.Root open={showFilters} onOpenChange={setShowFilters}>
              <Dialog.Trigger className={`${buttonVariants({ variant: "outline", size: "icon" })} shrink-0 md:hidden`} aria-label="Open job filters">
                <SlidersHorizontal className="size-4" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-foreground/35 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
                <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl border bg-background p-5 shadow-2xl transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="text-lg font-bold">Filter opportunities</Dialog.Title>
                      <Dialog.Description className="mt-1 text-xs text-muted-foreground">Narrow recommendations already approved by your profile threshold.</Dialog.Description>
                    </div>
                    <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Close filters"><X /></Dialog.Close>
                  </div>
                  <FilterFields idPrefix="mobile" {...filterProps} />
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={clearFilters} disabled={!hasUserFilters}>Clear</Button>
                    <Dialog.Close className={buttonVariants()}>Show {filteredJobs.length} jobs</Dialog.Close>
                  </div>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </div>

          <details className="mt-4 hidden border-t pt-4 md:block">
            <summary className="cursor-pointer text-sm font-semibold">Filters & sorting{hasUserFilters ? " · filters applied" : ""}</summary>
            <div className="mt-4">
            <FilterFields idPrefix="desktop" {...filterProps} />
            </div>
          </details>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              <Filter className="size-3.5" />
              <span><strong className="text-foreground">{loading ? "—" : filteredJobs.length}</strong> {filteredJobs.length === 1 ? "opportunity" : "opportunities"}</span>
            </p>
            {hasUserFilters && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-primary hover:underline">Clear filters</button>}
          </div>
          {!loading && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5" aria-label="Active filters">
              <FilterChip>Profile minimum: {profileMinimum}%</FilterChip>
              {minimumScore > profileMinimum && <FilterChip onRemove={() => setMinimumScore(profileMinimum)}>{minimumScore}%+ match</FilterChip>}
              {location !== "all" && <FilterChip onRemove={() => setLocation("all")}>{location}</FilterChip>}
              {remote !== "all" && <FilterChip onRemove={() => setRemote("all")}>{remote === "remote" ? "Remote" : "On-site"}</FilterChip>}
              {employmentType !== "all" && <FilterChip onRemove={() => setEmploymentType("all")}>{employmentType}</FilterChip>}
              {sort !== "match" && <FilterChip onRemove={() => setSort("match")}>{sort === "recent" ? "Most recent" : "Highest salary"}</FilterChip>}
            </div>
          )}
        </section>

        {(error || notice) && (
          <div className={`mt-5 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${error ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"}`}
            role={error ? "alert" : "status"}>
            <span>{error || notice}</span>
            <div className="flex gap-2">
              {error && setupCode && <Link href="/profile" className={buttonVariants({ variant: "outline", size: "sm" })}>Complete setup</Link>}
              {error && !setupCode && <Button variant="outline" size="sm" onClick={() => void loadJobs()}>Retry</Button>}
              <button type="button" onClick={() => { setError(""); setNotice(""); }}
                className="grid size-8 place-items-center rounded-lg hover:bg-background/50" aria-label="Dismiss message"><X className="size-3.5" /></button>
            </div>
          </div>
        )}

        <section className="mt-5" aria-labelledby="results-heading">
          <h2 id="results-heading" className="sr-only">Recommended jobs</h2>
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 6 }, (_, index) => <SkeletonCard key={index} />)}</div>
          ) : error && jobs.length === 0 ? (
            <EmptyState icon={<BriefcaseBusiness />} title="Recommendations unavailable"
              description="We couldn’t load your job feed. Retry, or complete the requested setup to continue."
              action={<Button onClick={() => void loadJobs()}>Try again</Button>} />
          ) : jobs.length === 0 ? (
            <EmptyState icon={<RefreshCw />} title="Your feed is ready for its first refresh"
              description="Bring in current opportunities from Himalayas and rank them against your profile."
              action={<Button onClick={() => void syncJobs()} disabled={syncing}><RefreshCw className={syncing ? "animate-spin" : ""} />Refresh jobs</Button>} />
          ) : filteredJobs.length === 0 ? (
            <EmptyState icon={<Search />} title="No jobs match these filters"
              description="Broaden your search or reset the workspace filters. Your saved profile minimum will stay in place."
              action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} resumeSkills={resumeSkills}
                  saved={savedIds.has(job.id)} saving={savingIds.has(job.id)}
                  applicationStatus={applications.get(job.id)} onSave={toggleSave} />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-2 text-center text-[11px] leading-5 text-muted-foreground">
          <span>Listings sourced from</span>
          <a href="https://himalayas.app/jobs" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-foreground">Himalayas <ArrowUpRight className="size-3" /></a>
          <span>• JobPilot adds profile-based matching.</span>
        </footer>
      </div>
    </main>
  );
}

function JobCard({ job, resumeSkills, saved, saving, applicationStatus, onSave }: {
  job: Job;
  resumeSkills: string[];
  saved: boolean;
  saving: boolean;
  applicationStatus?: string;
  onSave: (jobId: string) => Promise<void>;
}) {
  const salary = formatSalary(job);
  const published = formatPublished(job.published_at);
  const remote = isRemoteJob(job);
  const signals = strongestSignals(job, resumeSkills);
  const applicationUrl = safeExternalUrl(job.application_url);
  return (
    <article className="interactive-card group overflow-hidden rounded-2xl border bg-card">
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <div className="grid size-11 shrink-0 place-items-center rounded-xl border bg-muted/60 text-xs font-bold text-muted-foreground">{initials(job.company_name)}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border bg-background px-2 py-1 text-[10px] font-semibold capitalize text-muted-foreground">{job.source || "Himalayas"}</span>
              {applicationStatus && <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold capitalize text-primary">{applicationStatus}</span>}
            </div>
            <h3 className="mt-2.5 line-clamp-2 text-base font-bold leading-5 tracking-tight">{job.title || "Untitled position"}</h3>
            <p className="mt-1 truncate text-xs font-medium text-muted-foreground">{job.company_name || "Company not listed"}</p>
          </div>
          <ScoreRing score={job.match_score} />
        </div>

        <div className="mt-4 flex flex-wrap gap-1.5">
          <MetaChip><MapPin className="size-3" />{job.location || "Location not listed"}</MetaChip>
          <MetaChip><BriefcaseBusiness className="size-3" />{remote ? "Remote" : job.employment_type || "On-site"}</MetaChip>
          {job.employment_type && remote && <MetaChip>{job.employment_type}</MetaChip>}
          {salary && <MetaChip>{salary}</MetaChip>}
          {published && <MetaChip title={job.published_at ? new Date(job.published_at).toLocaleDateString() : undefined}>
            <Clock3 className="size-3" /><time dateTime={job.published_at || undefined} suppressHydrationWarning>{published}</time>
          </MetaChip>}
        </div>

        {signals.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">Strongest signals</p>
            <div className="flex flex-wrap gap-1.5">
              {signals.map((signal) => <span key={signal} className="inline-flex items-center gap-1 rounded-lg border bg-background px-2 py-1 text-[10px] font-medium"><Check className="size-3 text-emerald-500" />{signal}</span>)}
            </div>
          </div>
        )}

        {job.match_breakdown && (
          <details className="mt-4 rounded-xl border bg-muted/25 open:bg-muted/40">
            <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 text-xs font-semibold [&::-webkit-details-marker]:hidden">
              Why this is a {scoreLabel(job.match_score).toLowerCase()} match
              <ChevronDown className="size-3.5 text-muted-foreground" />
            </summary>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t px-3 py-3 sm:grid-cols-3">
              <Breakdown label="Role" value={job.match_breakdown.role} max={30} />
              <Breakdown label="Skills" value={job.match_breakdown.skills} max={30} />
              <Breakdown label="Location" value={job.match_breakdown.location} max={15} />
              <Breakdown label="Experience" value={job.match_breakdown.seniority} max={10} />
              <Breakdown label="Salary" value={job.match_breakdown.salary} max={10} />
              <Breakdown label="Country" value={job.match_breakdown.country} max={5} />
            </div>
          </details>
        )}

        <div className="mt-4 grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[1fr_auto_auto]">
          <Link href={`/jobs/${job.id}`} className={`${buttonVariants()} h-10`}>View details</Link>
          <Link href={`/jobs/${job.id}/prepare`} className={buttonVariants({ variant: "outline", size: "icon" })}
            aria-label={`Prepare for ${job.title || "this job"}`}><Sparkles /></Link>
          {applicationStatus ? (
            <Link href="/applications" className={`${buttonVariants({ variant: "outline" })} col-span-2 h-10 sm:col-span-1`}>View application</Link>
          ) : applicationUrl ? (
            <a href={applicationUrl} target="_blank" rel="noreferrer"
              className={`${buttonVariants({ variant: "outline" })} col-span-2 h-10 sm:col-span-1`}
              aria-label={`Apply for ${job.title || "this job"} (opens in a new tab)`}>Apply <ExternalLink className="size-3.5" /></a>
          ) : null}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t bg-muted/20 px-4 py-3 sm:px-5">
        <span className={`text-[10px] font-bold ${scoreTone(job.match_score)}`}>{scoreLabel(job.match_score)} fit · {job.match_score}% match</span>
        <button type="button" onClick={() => void onSave(job.id)} disabled={saving}
          aria-label={saved ? `Remove ${job.title || "job"} from saved jobs` : `Save ${job.title || "job"}`}
          className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-2 text-[10px] font-semibold ${saved ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
          {saving ? <Loader2 className="size-3.5 animate-spin" /> : <Heart className={`size-3.5 ${saved ? "fill-current" : ""}`} />}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </article>
  );
}

function ScoreRing({ score }: { score: number }) {
  const clamped = normalizeScore(score, 0);
  return (
    <div className="shrink-0 text-center" role="img" aria-label={`${score}% match, ${scoreLabel(score)} fit`}>
      <div className="grid size-12 place-items-center rounded-full"
        style={{ background: `conic-gradient(var(--primary) ${clamped * 3.6}deg, var(--muted) 0deg)` }}>
        <div className="grid size-9 place-items-center rounded-full bg-card text-[11px] font-bold">{score}%</div>
      </div>
      <span className={`mt-1 block text-[9px] font-bold ${scoreTone(score)}`}>{scoreLabel(score)}</span>
    </div>
  );
}

function Breakdown({ label, value = 0, max }: { label: string; value?: number; max: number }) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  return (
    <div>
      <div className="flex justify-between text-[10px]"><span className="text-muted-foreground">{label}</span><span className="font-semibold">{value}/{max}</span></div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function MetaChip({ children, title }: { children: ReactNode; title?: string }) {
  return <span title={title} className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-muted/70 px-2.5 py-1.5 text-[10px] font-medium text-muted-foreground">{children}</span>;
}

function FilterChip({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
      {children}
      {onRemove && <button type="button" onClick={onRemove} className="grid size-4 place-items-center rounded-full hover:bg-muted hover:text-foreground"
        aria-label={`Remove ${String(children)} filter`}><X className="size-2.5" /></button>}
    </span>
  );
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-xl border bg-background/60 px-2 py-2 text-center sm:min-w-[86px] sm:px-3">
      <p className="text-sm font-bold tracking-tight">{value}</p>
      <p className="mt-0.5 truncate text-[9px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}

function EmptyState({ icon, title, description, action }: {
  icon: ReactNode;
  title: string;
  description: string;
  action: ReactNode;
}) {
  return (
    <div className="surface p-8 text-center sm:p-12">
      <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground [&_svg]:size-6">{icon}</div>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-5 flex justify-center">{action}</div>
    </div>
  );
}
