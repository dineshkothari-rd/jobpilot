"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowUpRight, BriefcaseBusiness, Check, Clock,
  Coins, ExternalLink, Filter, GraduationCap, Heart, Loader2, MapPin, RefreshCw,
  Search, SlidersHorizontal, Sparkles, X,
} from "lucide-react";
import Link from "next/link";
import {
  type ReactNode, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { safeExternalUrl } from "@/lib/utils";
import { opportunityFreshness } from "@/lib/jobs/manual";
import {
  type WorkplaceFilter,
  detectWorkplaceType,
  matchesWorkplace,
} from "@/lib/jobs/filters";
import {
  type OpportunityCategory,
  type InternshipDuration,
  classifyOpportunityType,
  detectInternshipDuration,
  isInternshipOrFresher,
  matchesInternshipFilters,
  parseMonthlyStipend,
} from "@/lib/jobs/internships";

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
  expires_at: string | null;
  is_user_added: boolean;
  version: number;
  match_score: number;
  match_breakdown?: MatchBreakdown;
};

type SortOption = "match" | "recent" | "stipend";

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
    "expires_at",
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
    typeof value.is_user_added === "boolean" && typeof value.version === "number" && Number.isSafeInteger(value.version) && value.version > 0 &&
    (value.skills == null || (Array.isArray(value.skills) && value.skills.every((skill) => typeof skill === "string"))) &&
    breakdownKeys.every((key) =>
      typeof breakdown[key] === "number" && Number.isFinite(breakdown[key]));
}

function errorMessage(value: unknown, fallback: string) {
  return isRecord(value) && typeof value.error === "string" ? value.error : fallback;
}

function normalize(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function formatSourceName(source: string | null | undefined): string {
  if (!source) return "External";
  const normalized = source.toLowerCase().trim();
  if (normalized === "himalayas") return "Himalayas";
  if (normalized === "remotive") return "Remotive";
  if (normalized === "arbeitnow") return "Arbeitnow";
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function formatCompensationBadge(job: Job) {
  const parsed = parseMonthlyStipend(job);
  if (parsed.monthlyMin == null && parsed.monthlyMax == null) {
    if (job.salary_min != null || job.salary_max != null) {
      const min = job.salary_min;
      const max = job.salary_max;
      if (parsed.currency === "INR") {
        const toL = (v: number) => (v >= 100_000 ? `${(v / 100_000).toFixed(1)} LPA` : `₹${v.toLocaleString("en-IN")}`);
        if (min != null && max != null) return `₹${toL(min)} – ₹${toL(max)}`;
        if (min != null) return `₹${toL(min)}+`;
        return `Up to ₹${toL(max as number)}`;
      }
      if (min != null && max != null) return `$${min.toLocaleString()} – $${max.toLocaleString()}`;
      return `$${(min ?? max)?.toLocaleString()}`;
    }
    return "Stipend / CTC negotiable";
  }

  const prefix = parsed.currency === "INR" ? "₹" : "$";
  const suffix = parsed.isStipend ? "/mo" : "/mo CTC";

  if (parsed.monthlyMin != null && parsed.monthlyMax != null) {
    return `${prefix}${parsed.monthlyMin.toLocaleString("en-IN")} – ${prefix}${parsed.monthlyMax.toLocaleString("en-IN")}${suffix}`;
  }
  if (parsed.monthlyMin != null) {
    return `${prefix}${parsed.monthlyMin.toLocaleString("en-IN")}+${suffix}`;
  }
  return `Up to ${prefix}${parsed.monthlyMax?.toLocaleString("en-IN")}${suffix}`;
}

function formatDurationLabel(duration: "1-3m" | "3-6m" | "6m+" | "flexible"): string {
  switch (duration) {
    case "1-3m": return "1–3 Months";
    case "3-6m": return "3–6 Months";
    case "6m+": return "6+ Months";
    default: return "Flexible duration";
  }
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

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
  if (score >= 65) return "text-primary";
  if (score >= 50) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}

function initials(name: string | null) {
  return name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "JP";
}

type InternshipFilterFieldsProps = {
  idPrefix: string;
  category: OpportunityCategory;
  duration: InternshipDuration;
  workplace: WorkplaceFilter;
  minStipendFloor: number;
  sort: SortOption;
  onCategory: (val: OpportunityCategory) => void;
  onDuration: (val: InternshipDuration) => void;
  onWorkplace: (val: WorkplaceFilter) => void;
  onMinStipendFloor: (val: number) => void;
  onSort: (val: SortOption) => void;
};

function InternshipFilterFields(props: InternshipFilterFieldsProps) {
  const {
    idPrefix, category, duration, workplace, minStipendFloor, sort,
    onCategory, onDuration, onWorkplace, onMinStipendFloor, onSort,
  } = props;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Opportunity type</span>
        <select id={`${idPrefix}-category`} value={category} onChange={(e) => onCategory(e.target.value as OpportunityCategory)} className={fieldClass}>
          <option value="all">All student &amp; fresher roles</option>
          <option value="internship">Internships only</option>
          <option value="fresher">Fresher jobs (0-2 yrs)</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Duration</span>
        <select id={`${idPrefix}-duration`} value={duration} onChange={(e) => onDuration(e.target.value as InternshipDuration)} className={fieldClass}>
          <option value="all">Any duration</option>
          <option value="1-3m">1 – 3 Months</option>
          <option value="3-6m">3 – 6 Months</option>
          <option value="6m+">6+ Months / Co-op</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Minimum stipend / CTC</span>
        <select id={`${idPrefix}-stipend`} value={minStipendFloor} onChange={(e) => onMinStipendFloor(Number(e.target.value))} className={fieldClass}>
          <option value={0}>Any compensation</option>
          <option value={10000}>₹10,000+/mo ($500+)</option>
          <option value={25000}>₹25,000+/mo ($1,000+)</option>
          <option value={50000}>₹50,000+/mo ($2,000+)</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Workplace</span>
        <select id={`${idPrefix}-workplace`} value={workplace} onChange={(e) => onWorkplace(e.target.value as WorkplaceFilter)} className={fieldClass}>
          <option value="all">All workplace types</option>
          <option value="remote">Remote only</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">On-site only</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Sort by</span>
        <select id={`${idPrefix}-sort`} value={sort} onChange={(e) => onSort(e.target.value as SortOption)} className={fieldClass}>
          <option value="match">Best match</option>
          <option value="recent">Most recent</option>
          <option value="stipend">Highest compensation</option>
        </select>
      </label>
    </div>
  );
}

export default function InternshipsPage() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [resumeSkills, setResumeSkills] = useState<string[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [applications, setApplications] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<OpportunityCategory>("all");
  const [duration, setDuration] = useState<InternshipDuration>("all");
  const [workplace, setWorkplace] = useState<WorkplaceFilter>("all");
  const [minStipendFloor, setMinStipendFloor] = useState<number>(0);
  const [sort, setSort] = useState<SortOption>("match");
  const [showFilters, setShowFilters] = useState(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  const loadJobs = useCallback(async (background = false) => {
    const requestId = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (!background) setLoading(true);
      setError("");
      const supabase = createClient();
      const [response, authResult] = await Promise.all([
        fetch("/api/jobs/match", { cache: "no-store", signal: controller.signal }),
        supabase.auth.getUser(),
      ]);
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(errorMessage(result, "Unable to load internship opportunities."));
      }
      if (!isRecord(result) || !Array.isArray(result.jobs) || !result.jobs.every(isJob)) {
        throw new Error("The recommendations response was incomplete. Please retry.");
      }

      const user = authResult.data?.user;
      let nextSavedIds = new Set<string>();
      const nextApplications = new Map<string, string>();
      if (user) {
        const [savedResult, applicationResult] = await Promise.all([
          supabase.from("saved_jobs").select("job_id").eq("user_id", user.id),
          supabase.from("applications").select("job_id,status").eq("user_id", user.id),
        ]);
        if (!savedResult.error && savedResult.data) {
          nextSavedIds = new Set(
            savedResult.data.map((item) => item.job_id).filter((id): id is string => typeof id === "string"),
          );
        }
        if (!applicationResult.error && applicationResult.data) {
          for (const item of applicationResult.data) {
            if (typeof item.job_id === "string" && typeof item.status === "string") {
              nextApplications.set(item.job_id, item.status);
            }
          }
        }
      }

      if (requestId !== requestRef.current) return false;

      const uniqueJobs = Array.from(
        new Map(result.jobs.map((job) => [job.external_id || job.id, job])).values(),
      );

      // Filter specifically for internships and fresher opportunities
      const earlyCareerJobs = uniqueJobs.filter((job) => isInternshipOrFresher(job));

      setJobs(earlyCareerJobs);
      setResumeSkills(Array.isArray(result.resume_skills)
        ? result.resume_skills.filter((skill): skill is string => typeof skill === "string") : []);
      setSavedIds(nextSavedIds);
      setApplications(nextApplications);
      return true;
    } catch (loadErr) {
      if (loadErr instanceof DOMException && loadErr.name === "AbortError") return false;
      console.error("INTERNSHIPS LOAD ERROR:", loadErr);
      if (requestId === requestRef.current) {
        setError(loadErr instanceof Error ? loadErr.message : "Unable to load internship feed.");
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
    if (syncing || loading) return;
    setSyncing(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/jobs/sync", { method: "POST" });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) throw new Error(errorMessage(result, "Unable to refresh opportunities."));
      if (await loadJobs(true)) setNotice("Internship and fresher listings are up to date.");
    } catch (syncError) {
      setError(syncError instanceof Error ? syncError.message : "Unable to refresh opportunities.");
    } finally {
      setSyncing(false);
    }
  };

  const toggleSave = async (jobId: string) => {
    if (savingIds.has(jobId)) return;
    const wasSaved = savedIds.has(jobId);
    setSavingIds((cur) => new Set(cur).add(jobId));
    setSavedIds((cur) => {
      const next = new Set(cur);
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
        throw new Error(errorMessage(result, "Unable to update saved role."));
      }
      setSavedIds((cur) => {
        const next = new Set(cur);
        if (result.saved) next.add(jobId);
        else next.delete(jobId);
        return next;
      });
    } catch (saveErr) {
      setSavedIds((cur) => {
        const next = new Set(cur);
        if (wasSaved) next.add(jobId);
        else next.delete(jobId);
        return next;
      });
      setError(saveErr instanceof Error ? saveErr.message : "Unable to update saved role.");
    } finally {
      setSavingIds((cur) => {
        const next = new Set(cur);
        next.delete(jobId);
        return next;
      });
    }
  };

  const filteredJobs = useMemo(() => {
    const query = normalize(search);
    return jobs.filter((job) => {
      if (!matchesInternshipFilters(job, { category, duration, minStipendFloor })) {
        return false;
      }
      if (!matchesWorkplace(job, workplace)) return false;
      if (!query) return true;
      return normalize([
        job.title, job.company_name, job.location, job.country, job.description,
        job.employment_type, job.seniority, ...(job.skills || []),
      ].filter(Boolean).join(" ")).includes(query);
    }).sort((a, b) => {
      if (sort === "recent") return (Date.parse(b.published_at || "") || 0) - (Date.parse(a.published_at || "") || 0);
      if (sort === "stipend") {
        const sa = parseMonthlyStipend(a);
        const sb = parseMonthlyStipend(b);
        return (sb.monthlyMax ?? sb.monthlyMin ?? -1) - (sa.monthlyMax ?? sa.monthlyMin ?? -1);
      }
      return b.match_score - a.match_score;
    });
  }, [category, duration, jobs, minStipendFloor, search, sort, workplace]);

  const hasActiveFilters = Boolean(
    search || category !== "all" || duration !== "all" || workplace !== "all" ||
    minStipendFloor > 0 || sort !== "match",
  );

  const clearFilters = () => {
    setSearch("");
    setCategory("all");
    setDuration("all");
    setWorkplace("all");
    setMinStipendFloor(0);
    setSort("match");
  };

  const filterProps: Omit<InternshipFilterFieldsProps, "idPrefix"> = {
    category, duration, workplace, minStipendFloor, sort,
    onCategory: setCategory, onDuration: setDuration, onWorkplace: setWorkplace,
    onMinStipendFloor: setMinStipendFloor, onSort: setSort,
  };

  return (
    <div className="min-h-screen pb-8">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <header className="animate-float-in flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <GraduationCap className="size-4" />
              </span>
              <p className="section-label">Early Career &amp; Campus</p>
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-[34px]">
              Internships &amp; Fresher Jobs
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
              Curated opportunities for students, campus graduates, and early-career talent. Verified listings with role matching and direct application channels.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => void syncJobs()} disabled={syncing || loading}>
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Refreshing…" : "Refresh feed"}
            </Button>
            <Link href="/saved-jobs" className={buttonVariants({ size: "sm", variant: "secondary" })}>
              <Heart className="size-4" /> Saved
            </Link>
          </div>
        </header>

        {/* Career advice banner for freshers */}
        <section className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 size-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <h2 className="text-sm font-semibold text-emerald-950 dark:text-emerald-200">
                  Launching your career? Stand out to recruiters
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Highlight course projects, open-source work, and core fundamentals. Use our Interview Practice and Evidence Portfolio tools to prepare before applying.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 gap-2">
              <Link href="/practice" className={buttonVariants({ size: "sm", variant: "outline" })}>
                Practice questions
              </Link>
              <Link href="/portfolio" className={buttonVariants({ size: "sm" })}>
                Evidence Portfolio
              </Link>
            </div>
          </div>
        </section>

        {/* Search & Filter Toolbar */}
        <section className="sticky top-0 z-20 mt-5 rounded-2xl border bg-background/90 p-3 shadow-sm backdrop-blur-xl sm:p-4" aria-label="Search and filters">
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
                placeholder="Search internships by role, tech stack, company, or city" aria-label="Search internships"
                className="h-11 w-full rounded-xl border bg-muted/30 pl-10 pr-9 text-sm outline-none transition focus:bg-background focus:ring-2 focus:ring-ring/40" />
              {search && <button type="button" onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"><X className="size-3.5" /></button>}
            </div>

            <Dialog.Root open={showFilters} onOpenChange={setShowFilters}>
              <Dialog.Trigger className={`${buttonVariants({ variant: "outline", size: "icon" })} shrink-0 md:hidden`} aria-label="Open filters">
                <SlidersHorizontal className="size-4" />
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-foreground/35 backdrop-blur-sm transition-opacity" />
                <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] overflow-y-auto rounded-t-3xl border bg-background p-5 shadow-2xl">
                  <div className="mb-5 flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="text-lg font-bold">Filter internships &amp; fresher roles</Dialog.Title>
                      <Dialog.Description className="mt-1 text-xs text-muted-foreground">Adjust duration, compensation, and category.</Dialog.Description>
                    </div>
                    <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Close filters"><X /></Dialog.Close>
                  </div>
                  <InternshipFilterFields idPrefix="mobile" {...filterProps} />
                  <div className="mt-6 grid grid-cols-2 gap-2">
                    <Button variant="outline" onClick={clearFilters} disabled={!hasActiveFilters}>Clear</Button>
                    <Dialog.Close className={buttonVariants()}>Show {filteredJobs.length} roles</Dialog.Close>
                  </div>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </div>

          <details className="mt-4 hidden border-t pt-4 md:block">
            <summary className="cursor-pointer text-sm font-semibold">Filter parameters{hasActiveFilters ? " · filters applied" : ""}</summary>
            <div className="mt-4">
              <InternshipFilterFields idPrefix="desktop" {...filterProps} />
            </div>
          </details>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t pt-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground" aria-live="polite">
              <Filter className="size-3.5" />
              <span><strong className="text-foreground">{loading ? "—" : filteredJobs.length}</strong> {filteredJobs.length === 1 ? "early-career opportunity" : "early-career opportunities"}</span>
            </p>
            {hasActiveFilters && <button type="button" onClick={clearFilters} className="text-xs font-semibold text-primary hover:underline">Clear filters</button>}
          </div>

          {!loading && hasActiveFilters && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5" aria-label="Active filters">
              {category !== "all" && <FilterChip onRemove={() => setCategory("all")}>{category === "internship" ? "Internships only" : "Fresher jobs only"}</FilterChip>}
              {duration !== "all" && <FilterChip onRemove={() => setDuration("all")}>{formatDurationLabel(duration)}</FilterChip>}
              {workplace !== "all" && <FilterChip onRemove={() => setWorkplace("all")}>{workplace === "remote" ? "Remote" : workplace === "hybrid" ? "Hybrid" : "On-site"}</FilterChip>}
              {minStipendFloor > 0 && <FilterChip onRemove={() => setMinStipendFloor(0)}>₹{(minStipendFloor / 1000).toFixed(0)}k+/mo</FilterChip>}
              {sort !== "match" && <FilterChip onRemove={() => setSort("match")}>{sort === "recent" ? "Most recent" : "Highest compensation"}</FilterChip>}
            </div>
          )}
        </section>

        {(error || notice) && (
          <div className={`mt-5 flex flex-col gap-3 rounded-2xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between ${error ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400"}`}
            role={error ? "alert" : "status"}>
            <span>{error || notice}</span>
            <div className="flex gap-2">
              {error && <Button variant="outline" size="sm" onClick={() => void loadJobs()}>Retry</Button>}
              <button type="button" onClick={() => { setError(""); setNotice(""); }}
                className="grid size-8 place-items-center rounded-lg hover:bg-background/50" aria-label="Dismiss message"><X className="size-3.5" /></button>
            </div>
          </div>
        )}

        {/* Listings Section */}
        <section className="mt-5" aria-labelledby="internships-heading">
          <h2 id="internships-heading" className="sr-only">Internships and fresher jobs</h2>
          {loading ? (
            <div className="grid gap-4 lg:grid-cols-2">{Array.from({ length: 4 }, (_, idx) => <SkeletonCard key={idx} />)}</div>
          ) : error && jobs.length === 0 ? (
            <EmptyState icon={<BriefcaseBusiness />} title="Opportunities unavailable"
              description="We could not load early-career listings right now. Please retry."
              action={<Button onClick={() => void loadJobs()}>Try again</Button>} />
          ) : jobs.length === 0 ? (
            <EmptyState icon={<GraduationCap />} title="No internships found in the current pool"
              description="Refresh the feed to bring in the latest verified internships and entry-level positions."
              action={<Button onClick={() => void syncJobs()} disabled={syncing}><RefreshCw className={syncing ? "animate-spin" : ""} />Refresh feed</Button>} />
          ) : filteredJobs.length === 0 ? (
            <EmptyState icon={<Search />} title="No opportunities match your filter criteria"
              description="Broaden your search or reset the filters to see all campus and early-career listings."
              action={<Button variant="outline" onClick={clearFilters}>Clear filters</Button>} />
          ) : (
            <div className="divide-y rounded-xl border bg-card">
              {filteredJobs.map((job) => (
                <InternshipCard key={job.id} job={job} resumeSkills={resumeSkills}
                  saved={savedIds.has(job.id)} saving={savingIds.has(job.id)}
                  applicationStatus={applications.get(job.id)} onSave={toggleSave} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function InternshipCard({ job, resumeSkills, saved, saving, applicationStatus, onSave }: {
  job: Job; resumeSkills: string[]; saved: boolean; saving: boolean;
  applicationStatus?: string; onSave: (jobId: string) => Promise<void>;
}) {
  const oppType = classifyOpportunityType(job);
  const duration = detectInternshipDuration(job);
  const compensationBadge = formatCompensationBadge(job);
  const workplace = detectWorkplaceType(job);
  const published = formatPublished(job.published_at);
  const applicationUrl = safeExternalUrl(job.application_url);
  const freshness = opportunityFreshness(job);

  const matchedSkills = (job.skills || []).filter((s) =>
    resumeSkills.some((rs) => rs.toLowerCase() === s.toLowerCase()),
  );

  return (
    <article className="group px-4 py-4 transition-colors hover:bg-muted/20 sm:px-5">
      <div className="flex items-start gap-3">
        <div className="hidden size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground sm:grid">
          {initials(job.company_name)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/jobs/${job.id}`} className="text-base font-semibold leading-6 tracking-tight hover:text-primary">
              {job.title || "Untitled position"}
            </Link>
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${oppType === "internship" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400" : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"}`}>
              {oppType === "internship" ? "Internship" : "Fresher Role"}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{job.company_name || "Company not listed"}</p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <MapPin aria-hidden="true" className="size-3" />
              {job.location || "Location not specified"}
            </span>
            <span className="capitalize">{workplace}</span>
            {oppType === "internship" && duration !== "flexible" && (
              <span className="inline-flex items-center gap-1 font-medium text-foreground">
                <Clock aria-hidden="true" className="size-3 text-muted-foreground" />
                {formatDurationLabel(duration)}
              </span>
            )}
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <Coins aria-hidden="true" className="size-3 text-muted-foreground" />
              {compensationBadge}
            </span>
            <span className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {formatSourceName(job.source)}
            </span>
          </div>

          {matchedSkills.length > 0 && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-muted-foreground">Skill matches:</span>
              {matchedSkills.slice(0, 4).map((sk) => (
                <span key={sk} className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                  <Check className="size-2.5" />{sk}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1 self-start sm:flex-row sm:gap-2">
          <span className={`rounded-full bg-muted px-2.5 py-1.5 text-xs font-semibold ${scoreTone(job.match_score)}`}>
            {job.match_score}% match
          </span>
          <button type="button" onClick={() => void onSave(job.id)} disabled={saving} aria-pressed={saved}
            aria-label={saved ? `Remove ${job.title || "role"} from saved` : `Save ${job.title || "role"}`}
            className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Heart className={`size-4 ${saved ? "fill-primary text-primary" : ""}`} />}
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs">
        <span className="text-muted-foreground">
          {published ? `Posted ${published}` : "Current opportunity"}
          {applicationStatus ? ` · Status: ${applicationStatus}` : ""}
        </span>
        <div className="flex flex-wrap gap-2">
          <Link href={`/jobs/${job.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Review role <ArrowUpRight className="size-3.5" />
          </Link>
          <Link href={`/jobs/${job.id}/prepare`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Prepare interview
          </Link>
          {applicationUrl && freshness !== "expired" && !applicationStatus && (
            <a href={applicationUrl} target="_blank" rel="noopener noreferrer"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
              aria-label={`Apply directly on official site for ${job.title || "this role"}`}>
              Apply <ExternalLink className="size-3.5" />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function FilterChip({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
      {children}
      {onRemove && <button type="button" onClick={onRemove} className="grid size-4 place-items-center rounded-full hover:bg-muted hover:text-foreground"
        aria-label={`Remove filter`}><X className="size-2.5" /></button>}
    </span>
  );
}

function SkeletonCard() {
  return (
    <div className="surface p-5">
      <div className="h-5 w-48 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-4 w-full animate-pulse rounded bg-muted" />
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
