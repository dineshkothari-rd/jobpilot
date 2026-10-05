"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowUpRight, Bookmark, BookmarkPlus, BriefcaseBusiness, Check,
  ExternalLink, Filter, Heart, Loader2, MapPin, RefreshCw,
  Search, SlidersHorizontal, Sparkles, Trash2, X,
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
  type ExperienceFilter,
  type DatePostedFilter,
  type IndustryCategory,
  detectWorkplaceType,
  matchesWorkplace,
  matchesExperience,
  matchesDatePosted,
  matchesIndustry,
  matchesSalaryFloor,
} from "@/lib/jobs/filters";
import {
  type SavedSearchRecord,
  type SavedSearchCriteria,
  formatCriteriaSummary,
} from "@/lib/jobs/saved-searches";
import { companyToSlug } from "@/lib/companies/slug";
import { AddOpportunity } from "./add-opportunity";

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

type SortOption = "match" | "recent" | "salary";
type SourceFilter = "all" | "himalayas" | "remotive" | "arbeitnow" | "user";

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

function normalizeScore(value: unknown, fallback = 70) {
  const score = Number(value);
  return Number.isFinite(score) ? Math.min(100, Math.max(0, score)) : fallback;
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

function formatSalary(job: Job) {
  if (job.salary_min == null && job.salary_max == null) return null;
  const currency = job.salary_currency?.trim() || "";
  const isINR = currency.toUpperCase() === "INR" || currency === "₹";

  if (isINR) {
    const formatLakhs = (value: number) => {
      if (value >= 100_000) {
        const inLakhs = value / 100_000;
        return `${Number.isInteger(inLakhs) ? inLakhs : inLakhs.toFixed(1)} LPA`;
      }
      return `₹${value.toLocaleString("en-IN")}`;
    };
    if (job.salary_min != null && job.salary_max != null) {
      return `₹${formatLakhs(job.salary_min)} – ₹${formatLakhs(job.salary_max)}`;
    }
    if (job.salary_min != null) return `₹${formatLakhs(job.salary_min)}+`;
    return `Up to ₹${formatLakhs(job.salary_max as number)}`;
  }

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
  workplace: WorkplaceFilter;
  experience: ExperienceFilter;
  industry: IndustryCategory;
  datePosted: DatePostedFilter;
  salaryMinFloor: number;
  employmentType: string;
  employmentTypes: string[];
  sourceFilter: SourceFilter;
  sort: SortOption;
  onMinimumScore: (value: number) => void;
  onLocation: (value: string) => void;
  onWorkplace: (value: WorkplaceFilter) => void;
  onExperience: (value: ExperienceFilter) => void;
  onIndustry: (value: IndustryCategory) => void;
  onDatePosted: (value: DatePostedFilter) => void;
  onSalaryMinFloor: (value: number) => void;
  onEmploymentType: (value: string) => void;
  onSourceFilter: (value: SourceFilter) => void;
  onSort: (value: SortOption) => void;
};

function FilterFields(props: FilterFieldsProps) {
  const {
    idPrefix, minimumScore, profileMinimum, location, locations, workplace,
    experience, industry, datePosted, salaryMinFloor, employmentType,
    employmentTypes, sourceFilter, sort, onMinimumScore, onLocation,
    onWorkplace, onExperience, onIndustry, onDatePosted, onSalaryMinFloor,
    onEmploymentType, onSourceFilter, onSort,
  } = props;
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
        <span className="mb-1.5 block text-xs font-semibold">Workplace</span>
        <select value={workplace} onChange={(event) => onWorkplace(event.target.value as WorkplaceFilter)} className={fieldClass}>
          <option value="all">All workplace types</option>
          <option value="remote">Remote only</option>
          <option value="hybrid">Hybrid</option>
          <option value="onsite">On-site only</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Experience</span>
        <select value={experience} onChange={(event) => onExperience(event.target.value as ExperienceFilter)} className={fieldClass}>
          <option value="all">All experience levels</option>
          <option value="entry">Entry / Junior (0-2 yrs)</option>
          <option value="mid">Mid-level (2-5 yrs)</option>
          <option value="senior">Senior (5+ yrs)</option>
          <option value="lead">Lead / Staff / Director</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Industry / Function</span>
        <select value={industry} onChange={(event) => onIndustry(event.target.value as IndustryCategory)} className={fieldClass}>
          <option value="all">All industries</option>
          <option value="engineering">Engineering &amp; Tech</option>
          <option value="product">Product Management</option>
          <option value="design">Design &amp; Creative</option>
          <option value="data">Data, AI &amp; Analytics</option>
          <option value="sales-marketing">Sales &amp; Marketing</option>
          <option value="operations">Operations &amp; HR</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Date posted</span>
        <select value={datePosted} onChange={(event) => onDatePosted(event.target.value as DatePostedFilter)} className={fieldClass}>
          <option value="all">Any time</option>
          <option value="24h">Past 24 hours</option>
          <option value="7d">Past week</option>
          <option value="30d">Past month</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Minimum salary</span>
        <select value={salaryMinFloor} onChange={(event) => onSalaryMinFloor(Number(event.target.value))} className={fieldClass}>
          <option value={0}>Any compensation</option>
          <option value={50000}>$50k+ / ₹5 LPA</option>
          <option value={100000}>$100k+ / ₹10 LPA</option>
          <option value={150000}>$150k+ / ₹15 LPA</option>
          <option value={200000}>$200k+ / ₹20 LPA</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Source</span>
        <select value={sourceFilter} onChange={(event) => onSourceFilter(event.target.value as SourceFilter)} className={fieldClass}>
          <option value="all">All sources</option>
          <option value="himalayas">Himalayas</option>
          <option value="remotive">Remotive</option>
          <option value="arbeitnow">Arbeitnow</option>
          <option value="user">Added by you</option>
        </select>
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold">Location</span>
        <select value={location} onChange={(event) => onLocation(event.target.value)} className={fieldClass}>
          <option value="all">All locations</option>
          {locations.map((item) => <option key={item} value={item}>{item}</option>)}
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
  const [closingIds, setClosingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");
  const [setupCode, setSetupCode] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("all");
  const [workplace, setWorkplace] = useState<WorkplaceFilter>("all");
  const [experience, setExperience] = useState<ExperienceFilter>("all");
  const [industry, setIndustry] = useState<IndustryCategory>("all");
  const [datePosted, setDatePosted] = useState<DatePostedFilter>("all");
  const [salaryMinFloor, setSalaryMinFloor] = useState<number>(0);
  const [employmentType, setEmploymentType] = useState("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sort, setSort] = useState<SortOption>("match");
  const [showFilters, setShowFilters] = useState(false);
  const [savedSearchesList, setSavedSearchesList] = useState<SavedSearchRecord[]>([]);
  const [showSavedSearches, setShowSavedSearches] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [newSearchName, setNewSearchName] = useState("");
  const [savingSearch, setSavingSearch] = useState(false);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const syncLock = useRef(false);
  const saveLocks = useRef(new Set<string>());

  const loadSavedSearches = useCallback(async () => {
    try {
      const res = await fetch("/api/jobs/saved-searches");
      const data = await res.json().catch(() => null);
      if (res.ok && data && Array.isArray(data.saved_searches)) {
        setSavedSearchesList(data.saved_searches);
      }
    } catch (err) {
      console.error("Failed to load saved searches:", err);
    }
  }, []);

  const saveCurrentSearch = async () => {
    if (!newSearchName.trim()) return;
    setSavingSearch(true);
    try {
      const criteria: SavedSearchCriteria = {
        search: search || undefined,
        workplace: workplace !== "all" ? workplace : undefined,
        experience: experience !== "all" ? experience : undefined,
        industry: industry !== "all" ? industry : undefined,
        datePosted: datePosted !== "all" ? datePosted : undefined,
        salaryMinFloor: salaryMinFloor > 0 ? salaryMinFloor : undefined,
        location: location !== "all" ? location : undefined,
        employmentType: employmentType !== "all" ? employmentType : undefined,
        minimumScore: minimumScore !== profileMinimum ? minimumScore : undefined,
        sourceFilter: sourceFilter !== "all" ? sourceFilter : undefined,
        sort: sort !== "match" ? sort : undefined,
      };
      const res = await fetch("/api/jobs/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newSearchName.trim(), criteria }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Failed to save search.");
      setNotice(`Saved search "${newSearchName.trim()}" created.`);
      setShowSaveDialog(false);
      setNewSearchName("");
      await loadSavedSearches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save search.");
    } finally {
      setSavingSearch(false);
    }
  };

  const deleteSavedSearch = async (id: string) => {
    try {
      const res = await fetch(`/api/jobs/saved-searches?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSavedSearchesList((prev) => prev.filter((s) => s.id !== id));
        setNotice("Saved search deleted.");
      }
    } catch (err) {
      console.error("Failed to delete saved search:", err);
    }
  };

  const applySavedSearch = (record: SavedSearchRecord) => {
    const c = record.criteria;
    setSearch(c.search || "");
    setWorkplace(c.workplace || "all");
    setExperience(c.experience || "all");
    setIndustry(c.industry || "all");
    setDatePosted(c.datePosted || "all");
    setSalaryMinFloor(c.salaryMinFloor || 0);
    setLocation(c.location || "all");
    setEmploymentType(c.employmentType || "all");
    setMinimumScore(c.minimumScore ?? profileMinimum);
    setSourceFilter(c.sourceFilter || "all");
    setSort(c.sort || "match");
    setShowSavedSearches(false);
    setNotice(`Applied saved search "${record.name}".`);
  };

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
    const timer = window.setTimeout(() => {
      void loadJobs();
      void loadSavedSearches();
    }, 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
    };
  }, [loadJobs, loadSavedSearches]);

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

  const toggleClosed = async (job: Job) => {
    if (!job.is_user_added || closingIds.has(job.id)) return;
    const closed = opportunityFreshness(job) !== "expired";
    setClosingIds(current => new Set(current).add(job.id)); setError("");
    try {
      const response = await fetch("/api/jobs/manual", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: job.id, closed, version: job.version }) });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result?.job) throw new Error(result?.error || "We couldn’t update this opportunity.");
      setJobs(current => current.map(item => item.id === job.id ? { ...item, expires_at: result.job.expires_at, version: result.job.version } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t update this opportunity."); }
    finally { setClosingIds(current => { const next = new Set(current); next.delete(job.id); return next; }); }
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
      if (!job.is_user_added && job.match_score < minimumScore) return false;
      if (sourceFilter === "user" && !job.is_user_added) return false;
      if (sourceFilter !== "all" && sourceFilter !== "user") {
        if (job.is_user_added || (job.source || "").toLowerCase() !== sourceFilter) return false;
      }
      if (location !== "all" && job.location !== location) return false;
      if (!matchesWorkplace(job, workplace)) return false;
      if (!matchesExperience(job, experience)) return false;
      if (!matchesIndustry(job, industry)) return false;
      if (!matchesDatePosted(job.published_at, datePosted)) return false;
      if (!matchesSalaryFloor(job, salaryMinFloor)) return false;
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
  }, [datePosted, employmentType, experience, industry, jobs, location, minimumScore, salaryMinFloor, search, sort, sourceFilter, workplace]);

  const highMatches = useMemo(() => jobs.filter((job) => job.match_score >= 80).length, [jobs]);
  const averageMatch = useMemo(() => jobs.length
    ? Math.round(jobs.reduce((sum, job) => sum + job.match_score, 0) / jobs.length) : 0, [jobs]);
  const hasUserFilters = Boolean(
    search || minimumScore > profileMinimum || location !== "all" ||
    workplace !== "all" || experience !== "all" || industry !== "all" ||
    datePosted !== "all" || salaryMinFloor > 0 || employmentType !== "all" ||
    sourceFilter !== "all" || sort !== "match",
  );

  const clearFilters = () => {
    setSearch("");
    setMinimumScore(profileMinimum);
    setLocation("all");
    setWorkplace("all");
    setExperience("all");
    setIndustry("all");
    setDatePosted("all");
    setSalaryMinFloor(0);
    setEmploymentType("all");
    setSourceFilter("all");
    setSort("match");
  };

  const filterProps: Omit<FilterFieldsProps, "idPrefix"> = {
    minimumScore, profileMinimum, location, locations, workplace, experience, industry,
    datePosted, salaryMinFloor, employmentType, employmentTypes, sourceFilter, sort,
    onMinimumScore: setMinimumScore, onLocation: setLocation, onWorkplace: setWorkplace,
    onExperience: setExperience, onIndustry: setIndustry, onDatePosted: setDatePosted,
    onSalaryMinFloor: setSalaryMinFloor, onEmploymentType: setEmploymentType,
    onSourceFilter: setSourceFilter, onSort: setSort,
  };

  return (
    <div className="min-h-screen pb-8">
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
            <AddOpportunity onAdded={async () => { if (await loadJobs(true)) setNotice("Opportunity added and matched using your profile."); }} />
            <Button variant="outline" size="sm" onClick={() => void syncJobs()} disabled={syncing || loading}>
              <RefreshCw className={`size-4 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "Refreshing…" : "Refresh jobs"}
            </Button>
            <Link href="/saved-jobs" className={buttonVariants({ size: "sm", variant: "secondary" })}>
              <Heart className="size-4" /> Saved
            </Link>
          </div>
        </header>

        <section className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground" aria-label="Opportunity summary">
          <span>{loading ? "Checking your matches…" : `${jobs.length} recommended from ${totalScoredJobs} evaluated roles`}</span>
          {!loading && <><span>{highMatches} matches above 80%</span><span>{averageMatch}% average match</span></>}
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

            <Dialog.Root open={showSavedSearches} onOpenChange={setShowSavedSearches}>
              <Dialog.Trigger className={`${buttonVariants({ variant: "outline" })} shrink-0 flex items-center gap-1.5`} aria-label="Saved searches">
                <Bookmark className="size-4 text-primary" />
                <span className="hidden sm:inline">Saved searches</span>
                {savedSearchesList.length > 0 && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                    {savedSearchesList.length}
                  </span>
                )}
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-foreground/35 backdrop-blur-sm transition-opacity" />
                <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border bg-background p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="text-lg font-bold">Saved searches</Dialog.Title>
                      <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                        Re-run your custom filter configurations with one click.
                      </Dialog.Description>
                    </div>
                    <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Close saved searches">
                      <X className="size-4" />
                    </Dialog.Close>
                  </div>

                  {savedSearchesList.length === 0 ? (
                    <div className="py-8 text-center">
                      <Bookmark className="mx-auto size-8 text-muted-foreground/40" />
                      <p className="mt-2 text-sm font-semibold">No saved searches yet</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Configure filters on your feed, then click &ldquo;Save this search&rdquo;.
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y rounded-xl border">
                      {savedSearchesList.map((item) => (
                        <div key={item.id} className="flex items-center justify-between p-3.5 transition-colors hover:bg-muted/20">
                          <div className="min-w-0 flex-1 pr-3">
                            <p className="truncate text-sm font-semibold">{item.name}</p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              {formatCriteriaSummary(item.criteria).map((tag, i) => (
                                <span key={i} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground font-medium">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <Button size="sm" variant="secondary" onClick={() => applySavedSearch(item)}>
                              Apply
                            </Button>
                            <button
                              type="button"
                              onClick={() => void deleteSavedSearch(item.id)}
                              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                              aria-label={`Delete ${item.name}`}
                            >
                              <Trash2 className="size-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>

            <Dialog.Root open={showSaveDialog} onOpenChange={setShowSaveDialog}>
              <Dialog.Portal>
                <Dialog.Backdrop className="fixed inset-0 z-40 min-h-dvh bg-foreground/35 backdrop-blur-sm transition-opacity" />
                <Dialog.Popup className="fixed inset-x-0 bottom-0 z-50 max-h-[85dvh] overflow-y-auto rounded-t-3xl border bg-background p-5 shadow-2xl sm:inset-auto sm:left-1/2 sm:top-1/2 sm:w-full sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <Dialog.Title className="text-lg font-bold">Save current search</Dialog.Title>
                      <Dialog.Description className="mt-1 text-xs text-muted-foreground">
                        Save this exact set of keywords and filters to re-run in the future.
                      </Dialog.Description>
                    </div>
                    <Dialog.Close className={buttonVariants({ variant: "ghost", size: "icon-sm" })} aria-label="Close dialog">
                      <X className="size-4" />
                    </Dialog.Close>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="search-name-input" className="block text-xs font-semibold text-foreground">
                        Search name
                      </label>
                      <input
                        id="search-name-input"
                        type="text"
                        value={newSearchName}
                        onChange={(e) => setNewSearchName(e.target.value)}
                        placeholder="e.g. Remote Senior React Roles"
                        maxLength={100}
                        className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                      />
                    </div>

                    <div className="rounded-xl border bg-muted/30 p-3 text-xs text-muted-foreground">
                      <p className="font-semibold text-foreground mb-1">Configured filters to save:</p>
                      <div className="flex flex-wrap gap-1">
                        {formatCriteriaSummary({
                          search: search || undefined,
                          workplace: workplace !== "all" ? workplace : undefined,
                          experience: experience !== "all" ? experience : undefined,
                          industry: industry !== "all" ? industry : undefined,
                          datePosted: datePosted !== "all" ? datePosted : undefined,
                          salaryMinFloor: salaryMinFloor > 0 ? salaryMinFloor : undefined,
                          location: location !== "all" ? location : undefined,
                          employmentType: employmentType !== "all" ? employmentType : undefined,
                        }).map((tag, i) => (
                          <span key={i} className="rounded bg-background border px-1.5 py-0.5 text-[10px] font-medium">
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={() => setShowSaveDialog(false)} disabled={savingSearch}>
                        Cancel
                      </Button>
                      <Button onClick={() => void saveCurrentSearch()} disabled={savingSearch || !newSearchName.trim()}>
                        {savingSearch ? "Saving…" : "Save search"}
                      </Button>
                    </div>
                  </div>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>

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
              <span><strong className="text-foreground">{loading ? "—" : filteredJobs.length}</strong> {filteredJobs.length === 1 ? "opportunity" : "opportunities"}<span className="ml-2">· {profileMinimum}% minimum match</span></span>
            </p>
            {hasUserFilters && (
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setNewSearchName(search ? `${search} Search` : "My Filtered Roles");
                    setShowSaveDialog(true);
                  }}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                >
                  <BookmarkPlus className="size-3.5" /> Save this search
                </button>
                <button type="button" onClick={clearFilters} className="text-xs font-semibold text-muted-foreground hover:underline">
                  Clear filters
                </button>
              </div>
            )}
          </div>
          {!loading && hasUserFilters && (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5" aria-label="Active filters">
              {minimumScore > profileMinimum && <FilterChip onRemove={() => setMinimumScore(profileMinimum)}>{minimumScore}%+ match</FilterChip>}
              {workplace !== "all" && <FilterChip onRemove={() => setWorkplace("all")}>{workplace === "remote" ? "Remote" : workplace === "hybrid" ? "Hybrid" : "On-site"}</FilterChip>}
              {experience !== "all" && <FilterChip onRemove={() => setExperience("all")}>{experience === "entry" ? "Entry-level" : experience === "mid" ? "Mid-level" : experience === "senior" ? "Senior" : "Lead"}</FilterChip>}
              {industry !== "all" && <FilterChip onRemove={() => setIndustry("all")}>{industry}</FilterChip>}
              {datePosted !== "all" && <FilterChip onRemove={() => setDatePosted("all")}>{datePosted === "24h" ? "Past 24h" : datePosted === "7d" ? "Past 7d" : "Past 30d"}</FilterChip>}
              {salaryMinFloor > 0 && <FilterChip onRemove={() => setSalaryMinFloor(0)}>${(salaryMinFloor / 1000).toFixed(0)}k+ / ₹{(salaryMinFloor / 100000).toFixed(0)} LPA</FilterChip>}
              {sourceFilter !== "all" && <FilterChip onRemove={() => setSourceFilter("all")}>{formatSourceName(sourceFilter)}</FilterChip>}
              {location !== "all" && <FilterChip onRemove={() => setLocation("all")}>{location}</FilterChip>}
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
            <div className="divide-y rounded-xl border bg-card">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} resumeSkills={resumeSkills}
                  saved={savedIds.has(job.id)} saving={savingIds.has(job.id)}
                  closing={closingIds.has(job.id)} applicationStatus={applications.get(job.id)} onSave={toggleSave} onClosed={toggleClosed} />
              ))}
            </div>
          )}
        </section>

        <footer className="mt-8 flex flex-wrap items-center justify-center gap-x-2 text-center text-[11px] leading-5 text-muted-foreground">
          <span>Public listings aggregated from</span>
          <a href="https://himalayas.app/jobs" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-foreground">Himalayas <ArrowUpRight className="size-3" /></a>
          <span>·</span>
          <a href="https://remotive.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-foreground">Remotive <ArrowUpRight className="size-3" /></a>
          <span>·</span>
          <a href="https://www.arbeitnow.com" target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:text-foreground">Arbeitnow <ArrowUpRight className="size-3" /></a>
          <span>• JobPilot adds profile-based matching.</span>
        </footer>
      </div>
    </div>
  );
}

function JobCard({ job, resumeSkills, saved, saving, closing, applicationStatus, onSave, onClosed }: {
  job: Job; resumeSkills: string[]; saved: boolean; saving: boolean; closing: boolean;
  applicationStatus?: string; onSave: (jobId: string) => Promise<void>; onClosed: (job: Job) => Promise<void>;
}) {
  const salary = formatSalary(job);
  const published = formatPublished(job.published_at);
  const workplaceType = detectWorkplaceType(job);
  const signals = strongestSignals(job, resumeSkills);
  const applicationUrl = safeExternalUrl(job.application_url);
  const freshness = opportunityFreshness(job);
  return <article className="group px-4 py-4 transition-colors hover:bg-muted/20 sm:px-5">
    <div className="flex items-start gap-3">
      <div className="hidden size-10 shrink-0 place-items-center rounded-lg bg-muted text-xs font-bold text-muted-foreground sm:grid">{initials(job.company_name)}</div>
      <div className="min-w-0 flex-1">
        <Link href={`/jobs/${job.id}`} className="inline-block text-base font-semibold leading-6 tracking-tight hover:text-primary">{job.title || "Untitled position"}</Link>
        {job.company_name ? (
          <Link
            href={`/companies/${companyToSlug(job.company_name)}`}
            className="mt-1 block text-sm text-muted-foreground hover:text-primary hover:underline"
          >
            {job.company_name}
          </Link>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Company not listed</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><MapPin aria-hidden="true" className="size-3" />{job.location || "Location not listed"}</span>
          <span className="capitalize">{workplaceType === "remote" ? "Remote" : workplaceType === "hybrid" ? "Hybrid" : "On-site"}</span>
          {job.employment_type && <span>{job.employment_type}</span>}
          {salary && <span>{salary}</span>}
          <span className="rounded bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            {job.is_user_added ? "Personal" : formatSourceName(job.source)}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-1 self-start sm:flex-row sm:gap-2">
        <span className={`rounded-full bg-muted px-2.5 py-1.5 text-xs font-semibold ${scoreTone(job.match_score)}`}>{job.match_score}% match</span>
        <button type="button" onClick={() => void onSave(job.id)} disabled={saving} aria-pressed={saved}
          aria-label={saved ? `Remove ${job.title || "job"} from saved jobs` : `Save ${job.title || "job"}`}
          className="grid size-11 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-primary disabled:opacity-50">
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Heart className={`size-4 ${saved ? "fill-primary text-primary" : ""}`} />}
        </button>
      </div>
    </div>
    <details className="mt-3 text-xs">
      <summary className="min-h-11 cursor-pointer py-3 font-medium text-muted-foreground">Match details & application options</summary>
      <div className="space-y-4 border-t pt-4">
        <p className="text-muted-foreground">{scoreLabel(job.match_score)} fit · Source: {job.is_user_added ? "Added by you" : formatSourceName(job.source)}{published ? ` · ${published}` : ""} · {freshness === "expired" ? "Closed or expired" : freshness === "stale" ? "Older listing — verify before applying" : "Current based on recorded dates"}{applicationStatus ? ` · Application: ${applicationStatus}` : ""}</p>
        {signals.length > 0 && <p className="flex flex-wrap gap-2">{signals.map(signal => <span key={signal} className="inline-flex items-center gap-1"><Check className="size-3 text-emerald-600" />{signal}</span>)}</p>}
        {job.match_breakdown && <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Breakdown label="Role" value={job.match_breakdown.role} max={30} />
          <Breakdown label="Skills" value={job.match_breakdown.skills} max={30} />
          <Breakdown label="Location" value={job.match_breakdown.location} max={15} />
          <Breakdown label="Experience" value={job.match_breakdown.seniority} max={10} />
          <Breakdown label="Salary" value={job.match_breakdown.salary} max={10} />
          <Breakdown label="Country" value={job.match_breakdown.country} max={5} />
        </div>}
        <div className="flex flex-wrap gap-2">
          <Link href={`/jobs/${job.id}`} className={buttonVariants({ variant: "outline" })}>Review role<ArrowUpRight /></Link>
          <Link href={`/jobs/${job.id}/prepare`} className={buttonVariants({ variant: "ghost" })}>Prepare for interview</Link>
          {applicationStatus ? <Link href="/applications" className={buttonVariants({ variant: "ghost" })}>View application</Link> :
            applicationUrl && freshness !== "expired" ? <a href={applicationUrl} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "ghost" })} aria-label={`Apply for ${job.title || "this job"} (opens in a new tab)`}>Company form<ExternalLink /></a> : null}
          {job.is_user_added && <Button variant="ghost" disabled={closing} onClick={() => void onClosed(job)}>{freshness === "expired" ? "Reopen listing" : "Mark closed"}</Button>}
        </div>
      </div>
    </details>
  </article>;
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

function FilterChip({ children, onRemove }: { children: ReactNode; onRemove?: () => void }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full border bg-background px-2.5 py-1 text-[10px] font-semibold text-muted-foreground">
      {children}
      {onRemove && <button type="button" onClick={onRemove} className="grid size-4 place-items-center rounded-full hover:bg-muted hover:text-foreground"
        aria-label={`Remove ${String(children)} filter`}><X className="size-2.5" /></button>}
    </span>
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
