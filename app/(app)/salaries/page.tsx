"use client";

import {
  BriefcaseBusiness,
  Building2, CheckCircle2, Coins, ExternalLink,
  Info, MapPin, Sparkles, TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { ReportJob } from "@/components/report-job";
import { useEffect, useState } from "react";
import { buttonVariants } from "@/components/ui/button";
import { companyToSlug } from "@/lib/companies/slug";
import { safeExternalUrl } from "@/lib/utils";
import {
  ROLE_LABELS,
  formatCompensationValue,
  type RoleCategory,
  type SalaryBenchmark,
  type RawSalaryJob,
} from "@/lib/salaries/benchmarking";

const ROLES: Array<{ key: RoleCategory; label: string }> = [
  { key: "fullstack", label: "Fullstack Engineering" },
  { key: "frontend", label: "Frontend Engineering" },
  { key: "backend", label: "Backend Engineering" },
  { key: "mobile", label: "Mobile Development" },
  { key: "devops", label: "DevOps & Cloud" },
  { key: "data-ai", label: "Data Science & AI / ML" },
  { key: "product-design", label: "Product & Design" },
  { key: "qa-testing", label: "QA & Testing" },
  { key: "general-software", label: "General Software" },
];

const LOCATIONS = [
  { value: "all", label: "All Locations" },
  { value: "remote", label: "Remote only" },
  { value: "bengaluru", label: "Bengaluru" },
  { value: "hyderabad", label: "Hyderabad" },
  { value: "pune", label: "Pune" },
  { value: "mumbai", label: "Mumbai" },
  { value: "delhi", label: "Delhi-NCR" },
];

export default function SalariesPage() {
  const [role, setRole] = useState<RoleCategory>("fullstack");
  const [currency, setCurrency] = useState<"INR" | "USD">("INR");
  const [location, setLocation] = useState("all");

  const [benchmark, setBenchmark] = useState<SalaryBenchmark | null>(null);
  const [matchingJobs, setMatchingJobs] = useState<RawSalaryJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        setLoading(true);
        setError("");
        setBenchmark(null);
        setMatchingJobs([]);
        const params = new URLSearchParams({
          role,
          currency,
          location,
        });

        const res = await fetch(`/api/salaries?${params.toString()}`);
        const data = await res.json().catch(() => null);

        if (ignore) return;
        if (!res.ok) throw new Error(data?.error || "Failed to load salary benchmarks.");

        if (data?.benchmark) setBenchmark(data.benchmark);
        if (data?.matchingJobs) setMatchingJobs(data.matchingJobs);
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load salary benchmarks.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      ignore = true;
    };
  }, [role, currency, location]);

  return (
    <div className="min-h-screen pb-16">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <header className="animate-float-in">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Coins className="size-4" />
            </span>
            <p className="section-label">Market Intelligence</p>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-[34px]">
            Source-Backed Salary Benchmarks
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Compare compensation bands grounded exclusively in published salary ranges in job listings across India and remote markets. Figures describe advertised compensation, not employee pay or the whole market.
          </p>
        </header>

        {/* Filters */}
        <section aria-label="Salary benchmark filters" className="surface mt-6 p-4 sm:p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="role-select" className="block text-xs font-semibold text-foreground">
                Domain / Role
              </label>
              <select
                id="role-select"
                value={role}
                onChange={(e) => setRole(e.target.value as RoleCategory)}
                className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
              >
                {ROLES.map((r) => (
                  <option key={r.key} value={r.key}>{r.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="location-select" className="block text-xs font-semibold text-foreground">
                Location
              </label>
              <select
                id="location-select"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="mt-1.5 h-10 w-full rounded-xl border bg-background px-3 text-xs outline-none focus:ring-2 focus:ring-ring/40"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc.value} value={loc.value}>{loc.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-foreground">
                Currency
              </label>
              <div className="mt-1.5 flex h-10 items-center rounded-xl border bg-muted/30 p-1">
                <button
                  type="button"
                  aria-pressed={currency === "INR"}
                  onClick={() => setCurrency("INR")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${currency === "INR" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  ₹ INR (LPA)
                </button>
                <button
                  type="button"
                  aria-pressed={currency === "USD"}
                  onClick={() => setCurrency("USD")}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-semibold transition ${currency === "USD" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  $ USD (Annual)
                </button>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div role="alert" className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Benchmarks Section */}
        {loading ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <div key={i} className="surface p-6">
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="mt-4 h-8 w-32 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : benchmark?.insufficientData ? (
          <div className="surface mt-6 p-8 text-center sm:p-12">
            <Info className="mx-auto size-10 text-muted-foreground/40" />
            <h2 className="mt-3 text-lg font-bold">Limited compensation data for this filter</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
              We found fewer than 2 unexpired listings with explicit compensation published for {ROLE_LABELS[role]} in {currency === "INR" ? "INR" : "USD"}.
              To protect accuracy and prevent misleading benchmarks, we do not fabricate synthetic figures.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => setCurrency(currency === "INR" ? "USD" : "INR")}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Switch to {currency === "INR" ? "USD ($)" : "INR (₹)"}
              </button>
              <button
                type="button"
                onClick={() => setLocation("all")}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Clear location filter
              </button>
            </div>
          </div>
        ) : benchmark ? (
          <>
            {/* Core Metrics Cards */}
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="surface p-6">
                <p className="text-xs font-medium text-muted-foreground">25th Percentile</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
                  {formatCompensationValue(benchmark.p25, benchmark.currency)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  25% of sampled salary midpoints fall below this value.
                </p>
              </div>

              <div className="surface border-primary/40 bg-primary/5 p-6">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-primary">Median Compensation</p>
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    <Sparkles className="size-3" />
                    Sample Median
                  </span>
                </div>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-primary">
                  {formatCompensationValue(benchmark.median, benchmark.currency)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Median of salary midpoints across {benchmark.sampleCount} sampled listings.
                </p>
              </div>

              <div className="surface p-6">
                <p className="text-xs font-medium text-muted-foreground">75th Percentile</p>
                <p className="mt-2 text-3xl font-extrabold tracking-tight text-foreground">
                  {formatCompensationValue(benchmark.p75, benchmark.currency)}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  75% of sampled salary midpoints fall below this value.
                </p>
              </div>
            </div>

            <p className="mt-4 text-xs text-muted-foreground">Each listing contributes one salary range midpoint (or its single disclosed bound). Percentiles use linear interpolation. Only unexpired listings with positive salary bounds and explicit matching currency are included; currencies are never converted. Small samples may not represent the market.</p>

            {/* Source citations and range spread */}
            <div className="surface mt-4 flex flex-col gap-4 p-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-foreground">Sources cited:</span>
                {benchmark.sources.map((src) => (
                  <span key={src} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium capitalize text-foreground">
                    <CheckCircle2 className="size-3 text-emerald-500" />
                    {src}
                  </span>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-semibold text-foreground">Recorded Spread:</span>
                <span>
                  {formatCompensationValue(benchmark.min, benchmark.currency)} – {formatCompensationValue(benchmark.max, benchmark.currency)}
                </span>
              </div>
            </div>

            {/* Experience Progression Breakdown */}
            <section className="mt-8" aria-labelledby="experience-progression-heading">
              <h2 id="experience-progression-heading" className="text-lg font-bold tracking-tight sm:text-xl">
                Experience Progression
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Levels are inferred from titles and seniority, not verified years of experience. Groups below two samples are withheld.
              </p>

              <div className="surface mt-4 divide-y overflow-hidden rounded-2xl">
                {(
                  [
                    { key: "entry", label: "Entry Level", subtitle: "Freshers & Junior Engineers" },
                    { key: "mid", label: "Mid Level", subtitle: "Independent Contributors" },
                    { key: "senior", label: "Senior", subtitle: "Subject Matter Experts" },
                    { key: "lead", label: "Lead / Staff", subtitle: "Architects & Tech Leads" },
                    { key: "unknown", label: "Unspecified", subtitle: "No explicit experience level in title or seniority" },
                  ] as const
                ).map((lvl) => {
                  const data = benchmark.experienceBreakdown[lvl.key];
                  return (
                    <div key={lvl.key} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                      <div>
                        <h3 className="font-semibold text-foreground">{lvl.label}</h3>
                        <p className="text-xs text-muted-foreground">{lvl.subtitle}</p>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right">
                          <p className="text-sm font-bold text-foreground">
                            {formatCompensationValue(data.median, benchmark.currency)}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {data.sampleCount} postings · {data.p25 && data.p75
                              ? `Range: ${formatCompensationValue(data.p25, benchmark.currency)} – ${formatCompensationValue(data.p75, benchmark.currency)}`
                              : "Insufficient data"}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Contributing Live Openings */}
            <section className="mt-10" aria-labelledby="matching-roles-heading">
              <div className="flex items-center justify-between">
                <div>
                  <h2 id="matching-roles-heading" className="text-lg font-bold tracking-tight sm:text-xl">
                    Source Listings Contributing to This Benchmark
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Real active postings contributing to these benchmark bands.
                  </p>
                </div>
                <Link href="/jobs" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Explore all jobs
                </Link>
              </div>

              {matchingJobs.length === 0 ? (
                <div className="surface mt-4 p-8 text-center">
                  <BriefcaseBusiness className="mx-auto size-10 text-muted-foreground/40" />
                  <p className="mt-2 text-sm text-muted-foreground">No current active postings listed in this exact segment.</p>
                </div>
              ) : (
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {matchingJobs.map((job) => {
                    const appUrl = safeExternalUrl(job.source_url) || safeExternalUrl(job.application_url);
                    let formattedSalary = "";
                    if (job.salary_min && job.salary_max) {
                      formattedSalary = `${formatCompensationValue(job.salary_min, benchmark.currency)} – ${formatCompensationValue(job.salary_max, benchmark.currency)}`;
                    } else if (job.salary_min) {
                      formattedSalary = `${formatCompensationValue(job.salary_min, benchmark.currency)}+`;
                    } else if (job.salary_max) {
                      formattedSalary = `Up to ${formatCompensationValue(job.salary_max, benchmark.currency)}`;
                    }

                    return (
                      <article key={job.id} className="surface group flex flex-col justify-between p-5 transition-colors hover:border-primary/40">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              <TrendingUp className="size-3" />
                              {formattedSalary}
                            </span>
                            {job.source && (
                              <span className="text-[10px] uppercase font-semibold text-muted-foreground">
                                {job.source}
                              </span>
                            )}
                          </div>

                          <h3 className="mt-3 font-semibold text-foreground group-hover:text-primary">
                            <Link href={`/jobs/${job.id}`} className="hover:underline">
                              {job.title}
                            </Link>
                          </h3>

                          {job.company_name && (
                            <Link
                              href={`/companies/${companyToSlug(job.company_name)}`}
                              className="mt-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
                            >
                              <Building2 className="size-3" />
                              {job.company_name}
                            </Link>
                          )}

                          {job.location && (
                            <p className="mt-1.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="size-3" />
                              {job.location}
                            </p>
                          )}
                        </div>

                        <div className="mt-5 flex items-center justify-between border-t pt-3">
                          <Link href={`/jobs/${job.id}`} className="text-xs font-semibold text-primary hover:underline">
                            View role details
                          </Link>
                          {appUrl && (
                            <a
                              href={appUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={buttonVariants({ size: "sm" })}
                              aria-label={`View source for ${job.title}`}
                            >
                              View source <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      <ReportJob jobId={job.id} />
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
