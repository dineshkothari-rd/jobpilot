"use client";

import {
  ArrowLeft, ArrowUpRight, BriefcaseBusiness, Check, CircleAlert,
  Clipboard, ExternalLink, FileText, Heart, Lightbulb, Loader2,
  MapPin, MessageSquareText, RefreshCw, Sparkles, Target, X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  type ReactNode, useCallback, useEffect, useMemo, useRef, useState,
} from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import type { CopilotResult } from "@/lib/ai/application-copilot";
import { cn, safeExternalUrl } from "@/lib/utils";

type Section = "overview" | "resume" | "cover" | "strategy";
type ApplicationStatus = "saved" | "applied" | "screening" | "interview" | "offer" | "rejected" | "withdrawn";

type Job = {
  id: string;
  title: string | null;
  company_name: string | null;
  description: string | null;
  location: string | null;
  country: string | null;
  seniority: string | null;
  employment_type: string | null;
  skills: string[] | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  application_url: string | null;
  source_url: string | null;
  source: string | null;
  published_at: string | null;
};

type Match = {
  score: number;
  breakdown: {
    role: number;
    skills: number;
    location: number;
    seniority: number;
    salary: number;
    country: number;
  };
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
  resume: { id: string; file_name: string } | null;
};

type Resume = { id: string; file_name: string; is_primary: boolean };

type CopilotData = {
  job: Job;
  result: CopilotResult;
  match: Match | null;
  saved: boolean;
  application: Application | null;
  resume: Resume;
};

const sections: { id: Section; label: string; icon: ReactNode }[] = [
  { id: "overview", label: "Fit & actions", icon: <Target /> },
  { id: "resume", label: "Tailored resume", icon: <FileText /> },
  { id: "cover", label: "Cover letter", icon: <Clipboard /> },
  { id: "strategy", label: "Strategy", icon: <Lightbulb /> },
];

const statusLabels: Record<ApplicationStatus, string> = {
  saved: "Saved", applied: "Applied", screening: "Screening", interview: "Interview",
  offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn",
};
const applicationStatuses = Object.keys(statusLabels) as ApplicationStatus[];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isCopilotResult(value: unknown): value is CopilotResult {
  if (!isRecord(value)) return false;
  const textFields = [
    "fitLabel", "primaryRecommendation", "roleAlignment", "skillAlignment",
    "experienceAlignment", "tailoredSummary", "coverLetter", "positioning",
  ];
  const listFields = [
    "strengths", "missingKeywords", "improvementAreas", "resumeHighlights",
    "tailoredBullets", "suggestedKeywords", "strongestSellingPoints",
    "potentialObjections", "preparationActions",
  ];
  return typeof value.fitScore === "number" && Number.isFinite(value.fitScore) &&
    textFields.every((key) => typeof value[key] === "string") &&
    listFields.every((key) => stringArray(value[key])) &&
    Array.isArray(value.strategy) && value.strategy.every((item) =>
      isRecord(item) && typeof item.title === "string" && typeof item.description === "string");
}

function isJob(value: unknown): value is Job {
  if (!isRecord(value) || typeof value.id !== "string") return false;
  const stringsOrNull = [
    "title", "company_name", "description", "location", "country", "seniority",
    "employment_type", "salary_currency", "application_url", "source_url", "source", "published_at",
  ];
  return stringsOrNull.every((key) => value[key] === null || typeof value[key] === "string") &&
    ["salary_min", "salary_max"].every((key) => value[key] === null || typeof value[key] === "number") &&
    (value.skills === null || stringArray(value.skills));
}

function isMatch(value: unknown): value is Match {
  if (!isRecord(value) || typeof value.score !== "number" || !isRecord(value.breakdown)) return false;
  const breakdown = value.breakdown;
  return ["role", "skills", "location", "seniority", "salary", "country"]
    .every((key) => typeof breakdown[key] === "number");
}

function isApplication(value: unknown): value is Application {
  return isRecord(value) && typeof value.id === "string" && typeof value.job_id === "string" &&
    applicationStatuses.includes(value.status as ApplicationStatus) &&
    ["applied_at", "follow_up_at", "notes", "resume_id"].every((key) => value[key] === null || typeof value[key] === "string") &&
    typeof value.created_at === "string" && typeof value.updated_at === "string" &&
    (value.resume === null || (isRecord(value.resume) && typeof value.resume.id === "string" && typeof value.resume.file_name === "string"));
}

function isCopilotData(value: unknown): value is CopilotData {
  return isRecord(value) && isJob(value.job) && isCopilotResult(value.result) &&
    typeof value.saved === "boolean" && isRecord(value.resume) &&
    typeof value.resume.id === "string" && typeof value.resume.file_name === "string" &&
    (value.match === null || isMatch(value.match)) &&
    (value.application === null || isApplication(value.application));
}

function formatSalary(job: Job) {
  if (job.salary_min == null && job.salary_max == null) return null;
  const currency = job.salary_currency?.trim() || "";
  const prefix = currency ? `${currency} ` : "";
  const format = (value: number) => value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
  if (job.salary_min != null && job.salary_max != null) return `${prefix}${format(job.salary_min)} – ${format(job.salary_max)}`;
  if (job.salary_min != null) return `${prefix}${format(job.salary_min)}+`;
  return `Up to ${prefix}${format(job.salary_max as number)}`;
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "Not set" : date.toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function initials(name: string | null) {
  return name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "JP";
}

function scoreLabel(score: number) {
  if (score >= 85) return "Excellent";
  if (score >= 70) return "Strong";
  if (score >= 55) return "Potential";
  return "Needs work";
}

function CopyButton({ value, label, copied, onCopy, compact = false }: {
  value: string;
  label: string;
  copied: string;
  onCopy: (value: string, label: string) => Promise<void>;
  compact?: boolean;
}) {
  return <Button type="button" variant="outline" size={compact ? "icon-sm" : "sm"}
    onClick={() => void onCopy(value, label)} aria-label={`Copy ${label}`}>
    {copied === label ? <Check className="text-emerald-500" /> : <Clipboard />}
    {!compact && (copied === label ? "Copied" : "Copy")}
  </Button>;
}

export default function CopilotPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<CopilotData | null>(null);
  const [section, setSection] = useState<Section>("overview");
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tracking, setTracking] = useState(false);
  const [error, setError] = useState("");
  const [errorCode, setErrorCode] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");
  const abortRef = useRef<AbortController | null>(null);
  const requestRef = useRef(0);
  const copyTimer = useRef<number | null>(null);

  const loadCopilot = useCallback(async (background = false) => {
    const requestId = ++requestRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      if (background) setRegenerating(true);
      else setLoading(true);
      setError("");
      setErrorCode("");
      setNotice("");
      const response = await fetch(`/api/jobs/${params.id}/copilot`, {
        cache: "no-store", signal: controller.signal,
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        if (isRecord(result) && typeof result.code === "string") setErrorCode(result.code);
        throw new Error(isRecord(result) && typeof result.error === "string" ? result.error : "Application Copilot is unavailable.");
      }
      if (!isCopilotData(result)) throw new Error("Copilot returned an incomplete analysis. Please rebuild it.");
      if (requestId !== requestRef.current) return;
      setData(result);
      if (background) setNotice("Analysis rebuilt from your current resume and job context.");
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      console.error("COPILOT LOAD ERROR:", loadError);
      if (requestId === requestRef.current) setError(loadError instanceof Error ? loadError.message : "Application Copilot is unavailable.");
    } finally {
      if (requestId === requestRef.current) {
        setLoading(false);
        setRegenerating(false);
      }
    }
  }, [params.id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCopilot(), 0);
    return () => {
      window.clearTimeout(timer);
      abortRef.current?.abort();
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
    };
  }, [loadCopilot]);

  const copyText = async (value: string, label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      if (copyTimer.current) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(""), 1800);
    } catch (copyError) {
      console.error("COPY ERROR:", copyError);
      setError("Copy failed. Select the text and copy it manually.");
    }
  };

  const toggleSave = async () => {
    if (!data || saving) return;
    const wasSaved = data.saved;
    setSaving(true);
    setData({ ...data, saved: !wasSaved });
    try {
      const response = await fetch("/api/jobs/save", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: data.job.id, action: wasSaved ? "remove" : "save" }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(result) || typeof result.saved !== "boolean") throw new Error("Unable to update saved job.");
      setData((current) => current ? { ...current, saved: result.saved as boolean } : current);
    } catch (saveError) {
      console.error("COPILOT SAVE ERROR:", saveError);
      setData((current) => current ? { ...current, saved: wasSaved } : current);
      setError(saveError instanceof Error ? saveError.message : "Unable to update saved job.");
    } finally {
      setSaving(false);
    }
  };

  const markApplied = async () => {
    if (!data || tracking || data.application) return;
    setTracking(true);
    setError("");
    try {
      const response = await fetch("/api/applications", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: data.job.id, status: "applied", resumeId: data.resume.id }),
      });
      const result: unknown = await response.json().catch(() => null);
      if (!response.ok || !isRecord(result) || !isRecord(result.application) ||
        typeof result.application.id !== "string") throw new Error("Unable to track this application.");
      const application = result.application;
      setData((current) => current ? { ...current, application: {
        id: application.id as string,
        job_id: typeof application.job_id === "string" ? application.job_id : current.job.id,
        status: applicationStatuses.includes(application.status as ApplicationStatus)
          ? application.status as ApplicationStatus
          : "applied",
        applied_at: typeof application.applied_at === "string" ? application.applied_at : null,
        follow_up_at: typeof application.follow_up_at === "string" ? application.follow_up_at : null,
        notes: typeof application.notes === "string" ? application.notes : null,
        resume_id: typeof application.resume_id === "string" ? application.resume_id : current.resume.id,
        created_at: typeof application.created_at === "string" ? application.created_at : new Date().toISOString(),
        updated_at: typeof application.updated_at === "string" ? application.updated_at : new Date().toISOString(),
        resume: { id: current.resume.id, file_name: current.resume.file_name },
      } } : current);
      setNotice("Application added to your pipeline.");
    } catch (trackError) {
      console.error("COPILOT TRACK ERROR:", trackError);
      setError(trackError instanceof Error ? trackError.message : "Unable to track this application.");
    } finally {
      setTracking(false);
    }
  };

  const allContent = useMemo(() => data ? [
    "TAILORED SUMMARY", data.result.tailoredSummary,
    "TAILORED EXPERIENCE", ...data.result.tailoredBullets.map((item) => `• ${item}`),
    "SUPPORTED KEYWORDS", data.result.suggestedKeywords.join(", "),
    "COVER LETTER", data.result.coverLetter,
  ].join("\n\n") : "", [data]);

  if (loading) return <LoadingState />;

  if (!data) {
    const resumeProblem = ["NO_RESUME", "INVALID_RESUME", "EMPTY_RESUME"].includes(errorCode);
    return <main className="min-h-screen px-4 py-12 sm:px-6"><div className="surface mx-auto max-w-xl p-8 text-center"><div className="mx-auto grid size-14 place-items-center rounded-2xl bg-muted text-muted-foreground"><FileText className="size-6" /></div><h1 className="mt-5 text-xl font-bold">{resumeProblem ? "Your resume needs attention" : "Copilot couldn’t load"}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{error || "Application Copilot is unavailable."}</p><div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">{resumeProblem ? <Link href="/resume" className={buttonVariants()}>Review resume</Link> : <Button onClick={() => void loadCopilot()}>Try again</Button>}<Link href={`/jobs/${params.id}`} className={buttonVariants({ variant: "outline" })}>Back to job</Link></div></div></main>;
  }

  const { job, result, match, application, resume } = data;
  const salary = formatSalary(job);
  const applicationUrl = safeExternalUrl(job.application_url);
  const coverWords = result.coverLetter.trim().split(/\s+/).filter(Boolean).length;

  return (
    <main className="min-h-screen pb-40 md:pb-8">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <div className="flex items-center justify-between gap-3"><Link href={`/jobs/${job.id}`} className="inline-flex min-h-9 items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-3.5" />Back to job</Link><Link href="/applications" className="text-xs font-semibold text-primary hover:underline">Applications</Link></div>

        <header className="ai-surface mt-5 rounded-2xl border p-5 shadow-[var(--shadow-soft)] sm:p-6">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 gap-3.5"><span className="grid size-12 shrink-0 place-items-center rounded-2xl border bg-card text-sm font-bold text-muted-foreground">{initials(job.company_name)}</span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="section-label">Application Copilot</span>{job.source && <span className="rounded-full border bg-background px-2 py-1 text-[10px] font-semibold capitalize text-muted-foreground">{job.source}</span>}{application && <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{statusLabels[application.status]}</span>}</div><h1 className="mt-2 line-clamp-2 text-2xl font-bold tracking-tight sm:text-3xl">{job.title}</h1><p className="mt-1 text-sm font-medium text-muted-foreground">{job.company_name}</p><div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">{job.location && <span className="inline-flex items-center gap-1.5"><MapPin className="size-3.5" />{job.location}</span>}{job.employment_type && <span className="inline-flex items-center gap-1.5"><BriefcaseBusiness className="size-3.5" />{job.employment_type}</span>}{salary && <span>{salary}</span>}</div></div></div>
            <div className="grid grid-cols-2 gap-3 sm:w-fit"><ScoreCard label="Job match" score={match?.score ?? null} detail={match ? scoreLabel(match.score) : "Set preferences"} /><ScoreCard label="Readiness" score={result.fitScore} detail={result.fitLabel} /></div>
          </div>
          <div className="mt-5 flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.1em] text-primary">Primary recommendation</p><p className="mt-1 max-w-3xl text-sm leading-6">{result.primaryRecommendation}</p></div><Button variant="outline" size="sm" onClick={() => void loadCopilot(true)} disabled={regenerating}>{regenerating ? <Loader2 className="animate-spin" /> : <RefreshCw />}Rebuild analysis</Button></div>
        </header>

        {(error || notice) && <div role={error ? "alert" : "status"} className={cn("mt-4 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm", error ? "border-destructive/20 bg-destructive/5 text-destructive" : "border-emerald-500/20 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300")}>{error && <CircleAlert className="size-4 shrink-0" />}<span className="flex-1">{error || notice}</span><button type="button" onClick={() => { setError(""); setNotice(""); }} className="grid size-8 place-items-center rounded-lg hover:bg-background/50" aria-label="Dismiss message"><X className="size-3.5" /></button></div>}

        <nav className="sticky top-0 z-20 mt-5 flex gap-1 overflow-x-auto rounded-2xl border bg-background/90 p-1.5 shadow-sm backdrop-blur-xl" aria-label="Copilot sections">{sections.map((item) => <button key={item.id} type="button" onClick={() => setSection(item.id)} aria-current={section === item.id ? "page" : undefined} className={cn("inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-semibold [&_svg]:size-3.5", section === item.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground")}>{item.icon}{item.label}</button>)}<div className="ml-auto hidden items-center pr-1 sm:flex"><CopyButton value={allContent} label="all content" copied={copied} onCopy={copyText} /></div></nav>

        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0">
            {section === "overview" && <Overview result={result} match={match} onSection={setSection} />}
            {section === "resume" && <ResumeWorkspace result={result} resume={resume} copied={copied} onCopy={copyText} allContent={allContent} />}
            {section === "cover" && <CoverLetter result={result} words={coverWords} copied={copied} onCopy={copyText} />}
            {section === "strategy" && <Strategy result={result} jobId={job.id} />}
          </div>
          <aside className="space-y-4 xl:sticky xl:top-20"><JobContext job={job} /><ApplicationContext application={application} resume={resume} saving={saving} tracking={tracking} saved={data.saved} applicationUrl={applicationUrl} onSave={toggleSave} onTrack={markApplied} /></aside>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-[4.5rem] z-30 border-t bg-background/95 p-3 backdrop-blur md:hidden"><div className="mx-auto grid max-w-lg grid-cols-[auto_1fr] gap-2"><Button variant="outline" size="icon" onClick={() => void toggleSave()} disabled={saving} aria-label={data.saved ? "Unsave job" : "Save job"}>{saving ? <Loader2 className="animate-spin" /> : <Heart className={data.saved ? "fill-current text-primary" : ""} />}</Button>{applicationUrl ? <a href={applicationUrl} target="_blank" rel="noreferrer" className={buttonVariants()}>Apply now<ExternalLink /></a> : <Button disabled>Application link unavailable</Button>}</div></div>
    </main>
  );
}

function LoadingState() {
  return <main className="min-h-screen px-4 py-5 sm:px-6"><div className="mx-auto max-w-[1440px] animate-pulse"><div className="h-5 w-28 rounded bg-muted" /><div className="mt-5 h-64 rounded-2xl bg-muted" /><div className="mt-5 h-12 rounded-2xl bg-muted" /><div className="mt-5 grid gap-5 xl:grid-cols-[1fr_320px]"><div className="h-[520px] rounded-2xl bg-muted" /><div className="h-80 rounded-2xl bg-muted" /></div></div></main>;
}

function ScoreCard({ label, score, detail }: { label: string; score: number | null; detail: string }) {
  const value = score == null ? 0 : Math.min(100, Math.max(0, score));
  return <div className="min-w-[118px] rounded-2xl border bg-background/75 p-3 text-center"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p><div role="img" aria-label={score == null ? `${label} unavailable` : `${label}: ${score}%`} className="mx-auto mt-2 grid size-16 place-items-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${value * 3.6}deg, var(--muted) 0deg)` }}><div className="grid size-12 place-items-center rounded-full bg-background text-lg font-bold">{score == null ? "—" : `${score}%`}</div></div><p className="mt-2 text-[10px] font-semibold text-muted-foreground">{detail}</p></div>;
}

function Overview({ result, match, onSection }: { result: CopilotResult; match: Match | null; onSection: (section: Section) => void }) {
  return <div className="space-y-5"><section className="grid gap-4 md:grid-cols-2"><InsightCard title="Resume-supported strengths" tone="positive" items={result.strengths} empty="No supported strengths were detected." /><InsightCard title="Unsupported or missing" tone="warning" items={result.missingKeywords.map((item) => `${item} is not currently supported by the parsed resume.`)} empty="No recognized keyword gaps detected." /></section><section className="surface p-5 sm:p-6"><div><p className="section-label">Fit analysis</p><h2 className="mt-1 text-lg font-bold">What the evidence says</h2></div><div className="mt-5 grid gap-3 md:grid-cols-3"><AlignmentCard label="Role alignment" value={result.roleAlignment} score={match?.breakdown.role} max={30} /><AlignmentCard label="Skill alignment" value={result.skillAlignment} score={match?.breakdown.skills} max={30} /><AlignmentCard label="Relevant experience" value={result.experienceAlignment} score={match?.breakdown.seniority} max={10} /></div></section><section className="surface p-5 sm:p-6"><p className="section-label">Next best actions</p><h2 className="mt-1 text-lg font-bold">Turn analysis into a stronger application</h2><div className="mt-5 grid gap-3 sm:grid-cols-3">{result.preparationActions.map((item, index) => <button key={item} type="button" onClick={() => onSection(index === 0 ? "resume" : index === 1 ? "strategy" : "cover")} className="interactive-card rounded-2xl border p-4 text-left"><span className="text-[10px] font-bold text-primary">0{index + 1}</span><p className="mt-2 text-xs leading-5">{item}</p></button>)}</div></section></div>;
}

function InsightCard({ title, tone, items, empty }: { title: string; tone: "positive" | "warning"; items: string[]; empty: string }) {
  return <section className="surface p-5"><h2 className="text-sm font-bold">{title}</h2><div className="mt-4 space-y-3">{items.length ? items.map((item) => <div key={item} className="flex gap-2.5 text-xs leading-5"><span className={cn("mt-1 size-2 shrink-0 rounded-full", tone === "positive" ? "bg-emerald-500" : "bg-amber-500")} /><span>{item}</span></div>) : <p className="text-xs text-muted-foreground">{empty}</p>}</div></section>;
}

function AlignmentCard({ label, value, score, max }: { label: string; value: string; score?: number; max: number }) {
  const percent = typeof score === "number" ? Math.min(100, score / max * 100) : 0;
  return <div className="rounded-2xl border bg-muted/25 p-4"><div className="flex items-center justify-between"><h3 className="text-xs font-bold">{label}</h3>{typeof score === "number" && <span className="text-[10px] font-bold text-primary">{score}/{max}</span>}</div>{typeof score === "number" && <div className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} /></div>}<p className="mt-3 text-[11px] leading-5 text-muted-foreground">{value}</p></div>;
}

function ResumeWorkspace({ result, resume, copied, onCopy, allContent }: { result: CopilotResult; resume: Resume; copied: string; onCopy: (value: string, label: string) => Promise<void>; allContent: string }) {
  return <div className="space-y-5"><section className="surface overflow-hidden"><div className="flex flex-col gap-3 border-b p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="section-label">Tailored from {resume.file_name}</p><h2 className="mt-1 text-lg font-bold">Resume suggestions</h2></div><CopyButton value={allContent} label="all content" copied={copied} onCopy={onCopy} /></div><div className="p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Professional summary</h3><p className="mt-3 text-sm leading-7">{result.tailoredSummary}</p></div><CopyButton value={result.tailoredSummary} label="summary" copied={copied} onCopy={onCopy} compact /></div><div className="mt-6"><h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Experience evidence, ordered by relevance</h3>{result.tailoredBullets.length ? <div className="mt-3 space-y-3">{result.tailoredBullets.map((item, index) => <div key={`${index}-${item}`} className="flex items-start gap-3 rounded-2xl border bg-muted/20 p-4"><span className="mt-1 text-primary">•</span><p className="min-w-0 flex-1 text-sm leading-6">{item}</p><CopyButton value={item} label={`bullet ${index + 1}`} copied={copied} onCopy={onCopy} compact /></div>)}</div> : <p className="mt-3 rounded-xl border border-dashed p-4 text-xs text-muted-foreground">No usable experience or project descriptions were found. Add accurate evidence in Resume.</p>}</div>{result.suggestedKeywords.length > 0 && <div className="mt-6"><h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Supported keywords</h3><div className="mt-3 flex flex-wrap gap-2">{result.suggestedKeywords.map((keyword) => <span key={keyword} className="rounded-lg border bg-background px-2.5 py-1.5 text-[11px] font-semibold">{keyword}</span>)}</div></div>}</div></section><ReviewNotice /></div>;
}

function CoverLetter({ result, words, copied, onCopy }: { result: CopilotResult; words: number; copied: string; onCopy: (value: string, label: string) => Promise<void> }) {
  return <div className="space-y-5"><section className="surface overflow-hidden"><div className="flex items-center justify-between gap-4 border-b p-5"><div><p className="section-label">Draft document</p><h2 className="mt-1 text-lg font-bold">Cover letter</h2><p className="mt-1 text-[11px] text-muted-foreground">{words} words · {result.coverLetter.length} characters</p></div><CopyButton value={result.coverLetter} label="cover letter" copied={copied} onCopy={onCopy} /></div><div className="bg-muted/25 p-4 sm:p-7"><div className="mx-auto max-w-3xl rounded-sm border bg-card p-5 shadow-sm sm:p-8"><div className="whitespace-pre-wrap text-sm leading-7">{result.coverLetter}</div></div></div></section><ReviewNotice /></div>;
}

function Strategy({ result, jobId }: { result: CopilotResult; jobId: string }) {
  return <div className="space-y-5"><section className="surface p-5 sm:p-6"><p className="section-label">Application strategy</p><h2 className="mt-1 text-lg font-bold">A concise plan for this role</h2><div className="mt-5 space-y-3">{result.strategy.map((item, index) => <div key={item.title} className="flex gap-4 rounded-2xl border p-4"><span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-xs font-bold text-primary">{index + 1}</span><div><h3 className="text-sm font-bold">{item.title}</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</p></div></div>)}</div></section><section className="grid gap-4 md:grid-cols-2"><InsightCard title="Strongest selling points" tone="positive" items={result.strongestSellingPoints} empty="No supported selling points detected." /><InsightCard title="Potential objections" tone="warning" items={result.potentialObjections} empty="No clear objections detected." /></section><section className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><h2 className="text-sm font-bold">How to position yourself</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{result.positioning}</p><div className="mt-4 flex flex-col gap-2 sm:flex-row"><Link href={`/jobs/${jobId}/interview`} className={buttonVariants()}><MessageSquareText />Open Interview Studio</Link><Link href={`/jobs/${jobId}/prepare`} className={buttonVariants({ variant: "outline" })}><Sparkles />Job preparation</Link></div></section></div>;
}

function ReviewNotice() {
  return <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-xs leading-5 text-amber-800 dark:text-amber-200"><strong>Review before use.</strong> These suggestions are deterministic drafts based on parsed resume data. Verify every claim, metric, and keyword before submitting; your stored resume is never changed automatically.</div>;
}

function JobContext({ job }: { job: Job }) {
  const sourceUrl = safeExternalUrl(job.source_url);
  return <section className="surface p-5"><h2 className="text-sm font-bold">Job context</h2><dl className="mt-4 space-y-3 text-xs"><ContextRow label="Location" value={job.location || "Not listed"} /><ContextRow label="Employment" value={job.employment_type || "Not listed"} /><ContextRow label="Seniority" value={job.seniority || "Not listed"} /><ContextRow label="Salary" value={formatSalary(job) || "Not listed"} /></dl>{job.skills?.length ? <div className="mt-4 border-t pt-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Key skills</p><div className="mt-2 flex flex-wrap gap-1.5">{job.skills.slice(0, 8).map((skill) => <span key={skill} className="rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold">{skill}</span>)}</div></div> : null}{job.source?.toLowerCase() === "himalayas" && <p className="mt-4 border-t pt-4 text-[10px] text-muted-foreground">Listing sourced from {sourceUrl ? <a href={sourceUrl} target="_blank" rel="noreferrer" className="font-semibold underline">Himalayas</a> : "Himalayas"}.</p>}</section>;
}

function ContextRow({ label, value }: { label: string; value: string }) {
  return <div className="flex items-start justify-between gap-4"><dt className="text-muted-foreground">{label}</dt><dd className="text-right font-semibold capitalize">{value}</dd></div>;
}

function ApplicationContext({ application, resume, saving, tracking, saved, applicationUrl, onSave, onTrack }: {
  application: Application | null;
  resume: Resume;
  saving: boolean;
  tracking: boolean;
  saved: boolean;
  applicationUrl: string | null;
  onSave: () => Promise<void>;
  onTrack: () => Promise<void>;
}) {
  return <section className="surface p-5"><div className="flex items-center justify-between"><h2 className="text-sm font-bold">Application</h2>{application && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">{statusLabels[application.status]}</span>}</div>{application ? <dl className="mt-4 space-y-3 text-xs"><ContextRow label="Applied" value={formatDate(application.applied_at)} /><ContextRow label="Follow-up" value={formatDate(application.follow_up_at)} /><ContextRow label="Resume" value={application.resume?.file_name || (application.resume_id ? "Resume unavailable" : "Not selected")} /></dl> : <p className="mt-3 text-xs leading-5 text-muted-foreground">This job is not in your application pipeline yet. Apply externally, then track it here with your primary resume.</p>}<div className="mt-5 grid gap-2"><Button variant="outline" onClick={() => void onSave()} disabled={saving}>{saving ? <Loader2 className="animate-spin" /> : <Heart className={saved ? "fill-current text-primary" : ""} />}{saved ? "Saved" : "Save job"}</Button>{application ? <Link href="/applications" className={buttonVariants()}>Open in Applications<ArrowUpRight /></Link> : <Button onClick={() => void onTrack()} disabled={tracking}>{tracking ? <Loader2 className="animate-spin" /> : <Check />}Mark as applied</Button>}{applicationUrl ? <a href={applicationUrl} target="_blank" rel="noreferrer" className={buttonVariants({ variant: "outline" })}>Open application URL<ExternalLink /></a> : <p className="rounded-xl border border-dashed p-3 text-center text-[10px] text-muted-foreground">Application URL unavailable</p>}<p className="text-[10px] leading-4 text-muted-foreground">Copilot uses {resume.file_name}. Generated content is not saved to or written over your resume.</p></div></section>;
}
