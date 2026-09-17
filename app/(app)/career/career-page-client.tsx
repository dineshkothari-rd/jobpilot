"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import type { CareerIntelligence, ScoreDimension, SkillInsight } from "@/lib/ai/career-intelligence";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowRight,
  BriefcaseBusiness,
  CheckCircle2,
  CircleDashed,
  Compass,
  FileText,
  Loader2,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type CareerResponse = {
  success: true;
  intelligence: CareerIntelligence;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isCareerResponse(value: unknown): value is CareerResponse {
  return isRecord(value) && value.success === true && isRecord(value.intelligence);
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} aria-hidden="true" />;
}

function EmptyPanel({ title, detail, href, cta }: { title: string; detail: string; href: string; cta: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-5 text-center">
      <CircleDashed className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-3 text-base font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{detail}</p>
      <Link href={href} className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
        {cta}
        <ArrowRight />
      </Link>
    </div>
  );
}

function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: React.ReactNode }) {
  return (
    <section className="surface p-4 sm:p-5">
      {eyebrow && <p className="section-label">{eyebrow}</p>}
      <h2 className="mt-1 text-lg font-bold tracking-tight">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ScoreRing({ value }: { value: number | null }) {
  const score = value ?? 0;

  return (
    <div
      role="img"
      aria-label={value == null ? "Career Score unavailable" : `Career Score ${value} out of 100`}
      className="grid size-32 shrink-0 place-items-center rounded-full sm:size-36"
      style={{
        background: value == null
          ? "var(--muted)"
          : `conic-gradient(var(--primary) ${score * 3.6}deg, var(--muted) 0deg)`,
      }}
    >
      <div className="grid size-24 place-items-center rounded-full bg-background text-center sm:size-28">
        <div>
          <p className="text-3xl font-bold tracking-tight">{value == null ? "--" : value}</p>
          <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">/ 100</p>
        </div>
      </div>
    </div>
  );
}

function DimensionRow({ dimension }: { dimension: ScoreDimension }) {
  return (
    <div className="rounded-xl border bg-background/70 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold">{dimension.label}</p>
        <span className="text-sm font-bold text-primary">{dimension.value == null ? "Unavailable" : dimension.value}</span>
      </div>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{dimension.detail}</p>
    </div>
  );
}

function SkillBadge({ skill }: { skill: SkillInsight }) {
  const tone = skill.state === "strong"
    ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
    : skill.state === "developing"
      ? "border-blue-500/20 bg-blue-500/10 text-blue-700 dark:text-blue-300"
      : skill.state === "high-priority"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        : "border-border bg-muted/40 text-muted-foreground";

  return (
    <div className={cn("rounded-xl border p-3", tone)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-bold capitalize">{skill.name}</p>
        <span className="rounded-full bg-background/70 px-2 py-0.5 text-[10px] font-bold">{skill.demand}</span>
      </div>
      <p className="mt-2 text-xs leading-5">{skill.detail}</p>
    </div>
  );
}

function StateIcon({ status }: { status: "ready" | "attention" | "unavailable" }) {
  if (status === "ready") return <CheckCircle2 className="size-4 text-emerald-600" />;
  if (status === "attention") return <AlertCircle className="size-4 text-amber-600" />;
  return <CircleDashed className="size-4 text-muted-foreground" />;
}

export function CareerPageClient() {
  const [data, setData] = useState<CareerIntelligence | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const response = await fetch("/api/career/intelligence", { cache: "no-store" });
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string"
          ? result.error
          : "Unable to load Career Intelligence.");
      }

      if (!isCareerResponse(result)) {
        throw new Error("Career Intelligence returned an incomplete response.");
      }

      setData(result.intelligence);
    } catch (loadError) {
      console.error("CAREER INTELLIGENCE LOAD ERROR:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load Career Intelligence.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);

    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 md:pb-10 lg:px-8">
        <Skeleton className="h-28" />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
          <Skeleton className="h-72" />
          <Skeleton className="h-72" />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
          <Skeleton className="h-48" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto grid min-h-screen w-full max-w-3xl place-items-center px-4 pb-28 pt-6 md:pb-10">
        <div className="surface p-6 text-center">
          <AlertCircle className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-xl font-bold">Career Intelligence is unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{error || "Please retry."}</p>
          <Button className="mt-5" onClick={() => void load(true)} disabled={refreshing}>
            {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const score = data.careerScore.value;
  const readyMarket = data.marketInsights.status === "ready";

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-28 pt-5 sm:px-6 md:pb-10 lg:px-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="section-label">Optional · career planning</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Your career plan</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Use your resume and current job matches to decide what to improve. You do not need to complete this plan before applying.
          </p>
        </div>
        <Button variant="outline" onClick={() => void load(true)} disabled={refreshing}>
          {refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}
          Refresh
        </Button>
      </header>

      <section className="ai-surface mt-5 rounded-2xl border border-primary/10 p-4 shadow-[var(--shadow-soft)] sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" />
              Next Best Action
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight">{data.nextBestAction.title}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">{data.nextBestAction.why}</p>
          </div>
          <Link href={data.nextBestAction.href} className={buttonVariants({ size: "lg" })}>
            {data.nextBestAction.cta}
            <ArrowRight />
          </Link>
        </div>
      </section>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.9fr]">
        <Section title="Career Score" eyebrow={data.targetRole || "Setup required"}>
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <ScoreRing value={score} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
                  {data.careerScore.label}
                </span>
                {data.targetRole && (
                  <span className="rounded-full border bg-background px-3 py-1 text-xs font-semibold">
                    Target: {data.targetRole}
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">{data.careerScore.explanation}</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {data.careerScore.breakdown.map((dimension) => (
                  <DimensionRow key={dimension.key} dimension={dimension} />
                ))}
              </div>
            </div>
          </div>
        </Section>

        <Section title="Readiness" eyebrow="Signals">
          <div className="space-y-3">
            {data.readiness.map((item) => (
              <Link
                key={item.key}
                href={item.href || "/career"}
                className="flex items-start gap-3 rounded-xl border bg-background/70 p-3 hover:bg-muted/40"
              >
                <StateIcon status={item.status} />
                <span className="min-w-0">
                  <span className="block text-sm font-bold">{item.label}</span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.detail}</span>
                </span>
              </Link>
            ))}
          </div>
        </Section>
      </div>

      <details className="surface mt-4 p-4 sm:p-5">
        <summary className="cursor-pointer font-bold">Explore skills, market insights & your longer-term roadmap</summary>
      <div className="mt-4 grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
        <Section title="Skill Gap Analysis" eyebrow="Resume vs market">
          {readyMarket ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {data.marketInsights.topSkills.map((skill) => (
                <SkillBadge key={skill.name} skill={skill} />
              ))}
            </div>
          ) : (
            <EmptyPanel
              title={data.marketInsights.status === "missing-target" ? "Target role needed" : "Not enough market data yet"}
              detail={data.marketInsights.methodology}
              href={data.marketInsights.status === "missing-target" ? "/profile" : "/jobs"}
              cta={data.marketInsights.status === "missing-target" ? "Update profile" : "Discover jobs"}
            />
          )}
        </Section>

        <Section title="Market Alignment" eyebrow={`${data.marketInsights.sampleSize} stored jobs analyzed`}>
          <div className="rounded-2xl border bg-background/70 p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-bold">Methodology</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{data.marketInsights.methodology}</p>
              </div>
              <div className="rounded-xl border bg-card px-4 py-3 text-center">
                <p className="text-2xl font-bold">{data.marketInsights.averageMatchScore ?? "--"}</p>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Avg match</p>
              </div>
            </div>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              ["Strong", data.skills.strong],
              ["Developing", data.skills.developing],
              ["High priority", data.skills.highPriority],
              ["Missing", data.skills.missing],
            ].map(([label, skills]) => (
              <div key={label as string} className="rounded-xl border bg-background/70 p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{label as string}</p>
                <p className="mt-2 text-sm font-semibold capitalize">{(skills as string[]).slice(0, 4).join(", ") || "None detected"}</p>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Section title="Priority Skills" eyebrow="Highest leverage gaps">
          {data.prioritySkills.length ? (
            <div className="space-y-3">
              {data.prioritySkills.map((skill) => (
                <div key={skill.name} className="rounded-xl border bg-background/70 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold capitalize">{skill.name}</p>
                      <p className="mt-1 text-xs font-semibold text-muted-foreground">{skill.currentState} coverage</p>
                    </div>
                    <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] font-bold text-primary">
                      {skill.priority}
                    </span>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{skill.why}</p>
                  <p className="mt-2 text-xs font-semibold">{skill.suggestedAction}</p>
                  <Link href={`/learn?q=${encodeURIComponent(skill.name)}`} className="mt-3 inline-flex min-h-11 items-center text-xs font-semibold text-primary underline">Find free learning for this skill →</Link>
                </div>
              ))}
            </div>
          ) : (
            <EmptyPanel
              title="No high-priority gap detected"
              detail="When stored jobs reveal repeated missing skills, they will appear here."
              href="/jobs"
              cta="Review jobs"
            />
          )}
        </Section>

        <Section title="30 / 60 / 90 Day Roadmap" eyebrow="Recommended, not completed">
          <div className="grid gap-3 md:grid-cols-3">
            {data.roadmap.map((phase) => (
              <div key={phase.range} className="rounded-2xl border bg-background/70 p-4">
                <p className="text-xs font-bold text-primary">{phase.range}</p>
                <h3 className="mt-2 text-base font-bold">{phase.title}</h3>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">{phase.focus}</p>
                <ul className="mt-4 space-y-2">
                  {phase.actions.map((action) => (
                    <li key={action} className="flex gap-2 text-xs leading-5">
                      <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-primary" />
                      <span>{action}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
        <Section title="Progress" eyebrow="Existing data only">
          <div className="grid gap-3 sm:grid-cols-2">
            {data.progress.map((item) => (
              <div key={item.label} className="rounded-xl border bg-background/70 p-3">
                <p className="text-2xl font-bold">{item.value}</p>
                <p className="mt-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">{item.label}</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Useful Workflows" eyebrow="Jump back into JobPilot">
          <div className="grid gap-3 sm:grid-cols-2">
            {data.usefulLinks.map((link) => (
              <Link key={link.href} href={link.href} className="group rounded-xl border bg-background/70 p-4 hover:bg-muted/40">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-bold">{link.label}</p>
                  <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{link.detail}</p>
              </Link>
            ))}
            <Link href="/jobs" className="group rounded-xl border bg-background/70 p-4 hover:bg-muted/40">
              <div className="flex items-center gap-2 text-sm font-bold"><BriefcaseBusiness className="size-4" />Job Preparation</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Open a job detail page, then use Prepare, Copilot, or Interview Studio.</p>
            </Link>
            <Link href="/profile" className="group rounded-xl border bg-background/70 p-4 hover:bg-muted/40">
              <div className="flex items-center gap-2 text-sm font-bold"><UserRound className="size-4" />Preferences</div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">Tune role, salary, location, and remote preferences.</p>
            </Link>
          </div>
        </Section>
      </div>

      </details>
      <footer className="mt-5 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
        <span className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1"><Target className="size-3" />Target-role grounded</span>
        <span className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1"><TrendingUp className="size-3" />Stored JobPilot jobs only</span>
        <span className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1"><Compass className="size-3" />Recommended roadmap</span>
        <span className="inline-flex items-center gap-1 rounded-full border bg-card px-3 py-1"><FileText className="size-3" />No raw resume text exposed</span>
      </footer>
    </div>
  );
}
