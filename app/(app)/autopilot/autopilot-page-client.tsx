"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import type { AutopilotPreferences } from "@/lib/autopilot/eligibility";
import { cn, safeExternalUrl } from "@/lib/utils";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  CheckCircle2,
  CirclePause,
  Clock3,
  ExternalLink,
  FileCheck2,
  Gauge,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useTransition, useId } from "react";

type Action = {
  id: string;
  action_type: string;
  status: string;
  reason: string;
  error_message: string | null;
  proof_url: string | null;
  retry_count: number;
  created_at: string;
  job_id: string | null;
  jobs:
    | { title: string; company_name: string; application_url: string | null }
    | { title: string; company_name: string; application_url: string | null }[]
    | null;
};

type Submission = {
  id: string;
  status: string;
  mode: string;
  application_url: string | null;
  created_at: string;
  jobs:
    | { title: string; company_name: string }
    | { title: string; company_name: string }[]
    | null;
};

type Dashboard = {
  preferences: AutopilotPreferences;
  setup: {
    profileCompleteness: number;
    resumeHealth: number;
    hasResume: boolean;
  };
  usage: { submittedToday: number };
  actions: Action[];
  submissions: Submission[];
  upcomingFollowUps: unknown[];
};

const workplaceModes = ["remote", "hybrid", "on-site"] as const;
const safetyRules = [
  "Blocked, duplicate, low-match, conflicting, or unsafe jobs are skipped.",
  "Unknown facts always move to Needs your approval.",
  "Applied is set only after a provider confirms submission.",
  "Captchas, login walls, and platform restrictions are never bypassed.",
];

const list = (value: string) =>
  [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))];

const joined = (value: string[]) => value.join(", ");

const relation = <T,>(value: T | T[] | null) =>
  Array.isArray(value) ? value[0] || null : value;

const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (character) => character.toUpperCase());

async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || "Request failed.");
  }
  return result;
}

function Metric({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof Bot;
  title: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="surface p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4" />
        <span className="text-xs font-bold">{title}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
    </div>
  );
}

function Field({
  label: fieldLabel,
  value,
  onChange,
  type = "text",
  placeholder,
  min,
  max,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  min?: number;
  max?: number;
}) {
  const id = useId();

  return (
    <label htmlFor={id} className="block">
      <span className="text-xs font-bold text-muted-foreground">{fieldLabel}</span>
      <input
        id={id}
        type={type}
        value={value}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm"
      />
    </label>
  );
}

function SettingsForm({
  draft,
  pending,
  onUpdate,
  onSave,
}: {
  draft: AutopilotPreferences;
  pending: boolean;
  onUpdate: <Key extends keyof AutopilotPreferences>(
    key: Key,
    value: AutopilotPreferences[Key],
  ) => void;
  onSave: () => void;
}) {
  return (
    <section id="settings" className="surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Settings2 className="size-5" />
        </span>
        <div>
          <h2 className="font-bold">One-time Autopilot setup</h2>
          <p className="text-xs text-muted-foreground">Facts and limits used for every run.</p>
        </div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Field
          label="Target roles"
          value={joined(draft.targetRoles)}
          placeholder="Frontend Engineer, Product Engineer"
          onChange={(value) => onUpdate("targetRoles", list(value))}
        />
        <Field
          label="Locations"
          value={joined(draft.locations)}
          placeholder="Remote, Bengaluru"
          onChange={(value) => onUpdate("locations", list(value))}
        />
        <Field
          label="Minimum salary"
          type="number"
          min={0}
          value={draft.salaryMin ?? ""}
          onChange={(value) => onUpdate("salaryMin", value ? Number(value) : null)}
        />
        <Field
          label="Maximum salary"
          type="number"
          min={0}
          value={draft.salaryMax ?? ""}
          onChange={(value) => onUpdate("salaryMax", value ? Number(value) : null)}
        />
        <Field
          label="Work authorization"
          value={draft.workAuthorization}
          placeholder="Your confirmed answer"
          onChange={(value) => onUpdate("workAuthorization", value)}
        />
        <Field
          label="Notice period"
          value={draft.noticePeriod}
          placeholder="For example: 30 days"
          onChange={(value) => onUpdate("noticePeriod", value)}
        />
        <Field
          label="Preferred companies"
          value={joined(draft.preferredCompanies)}
          onChange={(value) => onUpdate("preferredCompanies", list(value))}
        />
        <Field
          label="Blocked companies"
          value={joined(draft.blockedCompanies)}
          onChange={(value) => onUpdate("blockedCompanies", list(value))}
        />
        <Field
          label="Industries"
          value={joined(draft.industries)}
          onChange={(value) => onUpdate("industries", list(value))}
        />
        <Field
          label="Daily limit"
          type="number"
          min={1}
          max={50}
          value={draft.dailyLimit}
          onChange={(value) => onUpdate("dailyLimit", Number(value))}
        />
        <Field
          label="Minimum match score"
          type="number"
          min={0}
          max={100}
          value={draft.matchThreshold}
          onChange={(value) => onUpdate("matchThreshold", Number(value))}
        />

        <fieldset>
          <legend className="text-xs font-bold text-muted-foreground">Workplace</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {workplaceModes.map((mode) => (
              <label
                key={mode}
                className="flex min-h-11 items-center gap-2 rounded-xl border px-3 text-sm"
              >
                <input
                  type="checkbox"
                  checked={draft.workplaceModes.includes(mode)}
                  onChange={(event) =>
                    onUpdate(
                      "workplaceModes",
                      event.target.checked
                        ? [...draft.workplaceModes, mode]
                        : draft.workplaceModes.filter((item) => item !== mode),
                    )
                  }
                />
                {label(mode)}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      <label className="mt-5 flex items-start gap-3 rounded-xl border bg-muted/25 p-4">
        <input
          type="checkbox"
          className="mt-1"
          checked={draft.autoSubmit}
          onChange={(event) => onUpdate("autoSubmit", event.target.checked)}
        />
        <span>
          <strong className="text-sm">Allow automatic submit when supported</strong>
          <span className="mt-1 block text-xs leading-5 text-muted-foreground">
            Current sources use assisted apply until a safe provider integration returns submission proof.
          </span>
        </span>
      </label>

      <Button
        className="mt-5 w-full sm:w-auto"
        disabled={pending}
        onClick={onSave}
      >
        {pending ? <Loader2 className="animate-spin" /> : <Settings2 />}
        Save settings
      </Button>
    </section>
  );
}

function ApplicationQueue({
  submissions,
  reviewActions,
}: {
  submissions: Submission[];
  reviewActions: Action[];
}) {
  return (
    <section id="review" className="surface p-5 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-bold">Application queue</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Prepared packages and review items.
          </p>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
          {submissions.length + reviewActions.length}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {reviewActions.map((item) => {
          const job = relation(item.jobs);
          return (
            <article key={item.id} className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold">{job?.title || "Job application"}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {job?.company_name || "Company"}
                  </p>
                </div>
                <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                  Needs approval
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{item.reason}</p>
            </article>
          );
        })}
        {submissions.length ? (
          submissions.slice(0, 8).map((item) => {
            const job = relation(item.jobs);
            const externalUrl = safeExternalUrl(item.application_url);
            const url = externalUrl?.startsWith("https://") ? externalUrl : null;

            return (
              <article key={item.id} className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold">{job?.title || "Job application"}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {job?.company_name || "Company"} · {label(item.mode)}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700">
                    {label(item.status)}
                  </span>
                </div>
                {url ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
                  >
                    Open and apply
                    <ExternalLink className="size-3" />
                  </a>
                ) : null}
              </article>
            );
          })
        ) : reviewActions.length === 0 ? (
          <p className="rounded-xl border border-dashed p-5 text-center text-sm text-muted-foreground">
            Run Autopilot to prepare your first grounded application package.
          </p>
        ) : null}
      </div>
    </section>
  );
}

function ActivityLog({
  actions,
  pending,
  onRetry,
}: {
  actions: Action[];
  pending: boolean;
  onRetry: (id: string) => void;
}) {
  const skipped = actions.filter((item) => item.status === "skipped").length;
  const failed = actions.filter((item) => item.status === "failed").length;

  return (
    <section className="surface mt-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-bold">Automation activity</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Every decision is stored with a reason and retry state.
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          <span className="rounded-full bg-muted px-3 py-1.5">{skipped} skipped</span>
          <span className="rounded-full bg-destructive/10 px-3 py-1.5 text-destructive">
            {failed} failed
          </span>
        </div>
      </div>

      <div className="mt-4 divide-y">
        {actions.length ? (
          actions.map((item) => {
            const job = relation(item.jobs);
            const tone = item.status === "failed"
              ? "bg-destructive/10 text-destructive"
              : item.status === "completed"
                ? "bg-emerald-500/10 text-emerald-700"
                : "bg-muted text-muted-foreground";

            return (
              <article
                key={item.id}
                className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center"
              >
                <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone)}>
                  {item.status === "failed" ? (
                    <AlertTriangle className="size-4" />
                  ) : item.status === "completed" ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <Clock3 className="size-4" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">
                    {label(item.action_type)}
                    {job ? ` · ${job.title} at ${job.company_name}` : ""}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">
                    {item.error_message || item.reason}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border px-2.5 py-1 text-[11px] font-bold">
                    {label(item.status)}
                  </span>
                  {item.status === "failed" ? (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => onRetry(item.id)}
                    >
                      <RotateCcw />
                      Retry
                    </Button>
                  ) : null}
                </div>
              </article>
            );
          })
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No automation activity yet.
          </p>
        )}
      </div>
    </section>
  );
}

export function AutopilotPageClient({ initialData }: { initialData: Dashboard }) {
  const [data, setData] = useState(initialData);
  const [draft, setDraft] = useState(initialData.preferences);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const update = <Key extends keyof AutopilotPreferences>(
    key: Key,
    value: AutopilotPreferences[Key],
  ) => setDraft((current) => ({ ...current, [key]: value }));

  const refresh = async () => {
    const dashboard = await jsonRequest<Dashboard>("/api/autopilot", {
      cache: "no-store",
    });
    setData(dashboard);
    setDraft(dashboard.preferences);
  };

  const save = (preferences = draft) => {
    startTransition(async () => {
      try {
        setError("");
        setMessage("");
        const result = await jsonRequest<{ preferences: AutopilotPreferences }>(
          "/api/autopilot",
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(preferences),
          },
        );
        setDraft(result.preferences);
        setData((current) => ({ ...current, preferences: result.preferences }));
        setMessage(result.preferences.enabled ? "Autopilot settings saved." : "Autopilot paused.");
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Could not save settings.");
      }
    });
  };

  const run = (retryId?: string) => {
    startTransition(async () => {
      try {
        setError("");
        setMessage("");
        const result = await jsonRequest<{ processed: number }>("/api/autopilot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(retryId ? { retryId } : {}),
        });
        await refresh();
        setMessage(`Autopilot safely evaluated ${result.processed} jobs.`);
      } catch (runError) {
        setError(runError instanceof Error ? runError.message : "Autopilot run failed.");
      }
    });
  };

  const counts = useMemo(() => ({
    prepared: data.submissions.filter((item) => item.status === "prepared").length,
    review: new Set(
      data.actions
        .filter((item) => item.status === "needs_user_confirmation")
        .map((item) => item.job_id || item.id),
    ).size,
  }), [data.actions, data.submissions]);
  const reviewActions = useMemo(() => {
    const seen = new Set<string>();
    return data.actions.filter((item) => {
      const key = item.job_id || item.id;
      if (item.status !== "needs_user_confirmation" || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [data.actions]);

  const nextAction = !data.setup.hasResume
    ? {
        title: "Upload your resume",
        detail: "Autopilot needs a primary resume before it can prepare applications.",
        href: "/resume",
      }
    : data.setup.profileCompleteness < 100
      ? {
          title: "Finish your career profile",
          detail: "Complete factual details once so automation can stay grounded.",
          href: "/profile",
        }
      : !draft.workAuthorization || !draft.noticePeriod
        ? {
            title: "Confirm application facts",
            detail: "Add work authorization and notice period to unblock safe packages.",
            href: "#settings",
          }
        : counts.review
          ? {
              title: "Review pending decisions",
              detail: `${counts.review} job${counts.review === 1 ? " needs" : "s need"} your confirmation.`,
              href: "#review",
            }
          : {
              title: "Practice for your strongest match",
              detail: "Your setup is ready. Continue from a prepared application.",
              href: "/applications",
            };

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <header className="ai-surface rounded-3xl border p-5 sm:p-7">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="section-label"><Sparkles className="size-3.5" />Career Autopilot</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Less admin. Better applications.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              JobPilot ranks jobs, prepares grounded application packages, and explains every decision. It never invents facts or claims a submission without proof.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={draft.enabled ? "outline" : "default"}
              size="lg"
              disabled={pending}
              onClick={() => save({ ...draft, enabled: !draft.enabled })}
            >
              {draft.enabled ? <CirclePause /> : <Play />}
              {draft.enabled ? "Pause Autopilot" : "Turn on Autopilot"}
            </Button>
            <Button
              size="lg"
              disabled={pending || !draft.enabled}
              onClick={() => run()}
            >
              {pending ? <Loader2 className="animate-spin" /> : <RefreshCw />}
              Run now
            </Button>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2 text-xs">
          <span className={cn(
            "rounded-full px-3 py-1.5 font-bold",
            draft.enabled
              ? "bg-emerald-500/10 text-emerald-700"
              : "bg-muted text-muted-foreground",
          )}>
            {draft.enabled ? "Autopilot on" : "Autopilot paused"}
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1.5 font-bold text-primary">
            <ShieldCheck className="mr-1 inline size-3.5" />Grounded only
          </span>
          <span className="rounded-full bg-muted px-3 py-1.5 font-bold text-muted-foreground">
            {data.usage.submittedToday}/{draft.dailyLimit} submitted today
          </span>
        </div>
      </header>

      <div aria-live="polite" aria-atomic="true">
        {message || error ? (
          <div
            role={error ? "alert" : "status"}
            className={cn(
              "mt-4 rounded-xl border px-4 py-3 text-sm",
              error
                ? "border-destructive/30 bg-destructive/5 text-destructive"
                : "border-emerald-500/30 bg-emerald-500/5 text-emerald-700",
            )}
          >
            {error || message}
          </div>
        ) : null}
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric icon={Gauge} title="Resume health" value={`${data.setup.resumeHealth}%`} detail="Deterministic ATS check" />
        <Metric icon={FileCheck2} title="Profile complete" value={`${data.setup.profileCompleteness}%`} detail="Facts available to Autopilot" />
        <Metric icon={CheckCircle2} title="Packages ready" value={String(counts.prepared)} detail="Assisted applications" />
        <Metric icon={AlertTriangle} title="Needs approval" value={String(counts.review)} detail="Nothing submitted yet" />
      </section>

      <section className="surface mt-5 flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <p className="section-label">Today’s next best action</p>
          <h2 className="mt-2 text-xl font-bold">{nextAction.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{nextAction.detail}</p>
        </div>
        {nextAction.href.startsWith("/") ? (
          <Link href={nextAction.href} className={buttonVariants({ size: "lg" })}>
            Continue<ArrowRight />
          </Link>
        ) : (
          <a href={nextAction.href} className={buttonVariants({ size: "lg" })}>
            Continue<ArrowRight />
          </a>
        )}
      </section>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
        <SettingsForm
          draft={draft}
          pending={pending}
          onUpdate={update}
          onSave={() => save()}
        />
        <div className="space-y-5">
          <ApplicationQueue
            submissions={data.submissions}
            reviewActions={reviewActions}
          />
          <section className="surface p-5 sm:p-6">
            <h2 className="font-bold">Safety rules</h2>
            <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
              {safetyRules.map((item) => (
                <li key={item} className="flex gap-2">
                  <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                  {item}
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>

      <ActivityLog actions={data.actions} pending={pending} onRetry={run} />

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Link href="/resume/studio" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "justify-between")}>Resume Studio<ArrowRight /></Link>
        <Link href="/applications" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "justify-between")}>Application tracker<ArrowRight /></Link>
        <Link href="/career" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "justify-between")}>Preparation hub<ArrowRight /></Link>
      </div>
    </main>
  );
}
