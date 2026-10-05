"use client";

import {
  ArrowLeft, ArrowUpRight, Bell, BellRing, BriefcaseBusiness,
  Building2, Check, ExternalLink, Globe, MapPin,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { safeExternalUrl } from "@/lib/utils";
import { type CompanyDetail } from "@/lib/companies/service";

function initials(name: string | null) {
  return name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "CO";
}

function formatSalary(job: { salary_min: number | null; salary_max: number | null; salary_currency: string | null }) {
  if (job.salary_min == null && job.salary_max == null) return null;
  const currency = job.salary_currency?.trim() || "";
  const isINR = currency.toUpperCase() === "INR" || currency === "₹";

  if (isINR) {
    const toL = (v: number) => (v >= 100_000 ? `${(v / 100_000).toFixed(1)} LPA` : `₹${v.toLocaleString("en-IN")}`);
    if (job.salary_min != null && job.salary_max != null) {
      return `₹${toL(job.salary_min)} – ₹${toL(job.salary_max)}`;
    }
    if (job.salary_min != null) return `₹${toL(job.salary_min)}+`;
    return `Up to ₹${toL(job.salary_max as number)}`;
  }

  const format = (v: number) => v.toLocaleString("en-US");
  const prefix = currency ? `${currency} ` : "$";
  if (job.salary_min != null && job.salary_max != null) {
    return `${prefix}${format(job.salary_min)} – ${format(job.salary_max)}`;
  }
  if (job.salary_min != null) return `${prefix}${format(job.salary_min)}+`;
  return `Up to ${prefix}${format(job.salary_max as number)}`;
}

export default function CompanyDetailPage() {
  const params = useParams();
  const slug = typeof params?.slug === "string" ? params.slug : "";

  const [company, setCompany] = useState<CompanyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingBusy, setFollowingBusy] = useState(false);
  const [followNotice, setFollowNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/companies/${encodeURIComponent(slug)}`);
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Company profile not found.");
        if (data?.company) {
          setCompany(data.company);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load company profile.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/companies/${encodeURIComponent(slug)}/follow`)
      .then((res) => res.json())
      .then((data) => {
        if (data && typeof data.isFollowing === "boolean") {
          setIsFollowing(data.isFollowing);
          setFollowerCount(data.followerCount || 0);
        }
      })
      .catch((err) => console.warn("Failed to load follow status:", err));
  }, [slug]);

  const toggleFollow = async () => {
    if (followingBusy || !company) return;
    setFollowingBusy(true);
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);
    setFollowerCount((prev) => Math.max(0, prev + (nextFollowing ? 1 : -1)));

    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(slug)}/follow`, {
        method: nextFollowing ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: nextFollowing ? JSON.stringify({ companyName: company.name }) : undefined,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setIsFollowing(!nextFollowing);
        setFollowerCount((prev) => Math.max(0, prev + (nextFollowing ? -1 : 1)));
        throw new Error(data?.error || "Failed to update follow status.");
      }
      setFollowNotice(
        nextFollowing
          ? `You are now following ${company.name}. You'll be alerted when new roles open.`
          : `Unfollowed ${company.name}.`,
      );
      setTimeout(() => setFollowNotice(null), 4000);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Authentication required to follow companies.");
    } finally {
      setFollowingBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-[1440px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="h-4 w-28 animate-pulse rounded bg-muted" />
        <div className="mt-6 flex items-start gap-4">
          <div className="size-16 animate-pulse rounded-2xl bg-muted" />
          <div className="space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-muted" />
            <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !company) {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-16 text-center">
        <Building2 className="mx-auto size-12 text-muted-foreground/40" />
        <h1 className="mt-4 text-xl font-bold">Company profile unavailable</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error || "We couldn't find this company."}</p>
        <div className="mt-6">
          <Link href="/companies" className={buttonVariants({ variant: "outline" })}>
            <ArrowLeft className="size-4" /> Back to company directory
          </Link>
        </div>
      </div>
    );
  }

  const websiteUrl = company.domain ? safeExternalUrl(`https://${company.domain}`) : null;

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Link href="/companies" className="hover:text-foreground">Companies</Link>
          <span>/</span>
          <span className="font-medium text-foreground">{company.name}</span>
        </nav>

        {followNotice && (
          <div role="status" aria-live="polite" className="mt-4 flex items-center justify-between rounded-xl border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-foreground">
            <div className="flex items-center gap-2">
              <Check className="size-4 text-primary" />
              <span>{followNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setFollowNotice(null)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Company Header */}
        <header className="surface mt-5 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-bold text-primary sm:size-20">
                {initials(company.name)}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    {company.name}
                  </h1>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <Sparkles className="size-3" />
                    Verified Employer
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                  {company.locations.length > 0 && (
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {company.locations.slice(0, 3).join(", ")}
                    </span>
                  )}
                  {websiteUrl && (
                    <a
                      href={websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 hover:text-foreground hover:underline"
                    >
                      <Globe className="size-3.5" />
                      {company.domain}
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1">
                    <BriefcaseBusiness className="size-3.5" />
                    {company.jobCount} open {company.jobCount === 1 ? "role" : "roles"}
                  </span>
                  {followerCount > 0 && (
                    <span className="inline-flex items-center gap-1 text-muted-foreground">
                      <Bell className="size-3" />
                      {followerCount} {followerCount === 1 ? "follower" : "followers"}
                    </span>
                  )}
                </div>

                {company.skills.length > 0 && (
                  <div className="mt-3.5 flex flex-wrap items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">Common skills:</span>
                    {company.skills.slice(0, 8).map((skill) => (
                      <span
                        key={skill}
                        className="rounded-lg bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <Button
                variant={isFollowing ? "outline" : "default"}
                size="sm"
                onClick={toggleFollow}
                disabled={followingBusy}
                className="gap-1.5"
                aria-pressed={isFollowing}
              >
                {isFollowing ? (
                  <>
                    <BellRing className="size-4 text-primary" />
                    <span>Following</span>
                    {followerCount > 0 && (
                      <span className="ml-1 rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-bold text-muted-foreground">
                        {followerCount}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <Bell className="size-4" />
                    <span>Follow for alerts</span>
                    {followerCount > 0 && (
                      <span className="ml-1 rounded-full bg-primary-foreground/20 px-1.5 py-0.2 text-[10px] font-bold">
                        {followerCount}
                      </span>
                    )}
                  </>
                )}
              </Button>
              <Link href="/jobs" className={buttonVariants({ variant: "outline", size: "sm" })}>
                Explore all jobs
              </Link>
            </div>
          </div>
        </header>

        {/* Job Listings from this company */}
        <section className="mt-8" aria-labelledby="company-openings-heading">
          <div className="flex items-center justify-between">
            <h2 id="company-openings-heading" className="text-lg font-bold tracking-tight sm:text-xl">
              Current Openings ({company.jobCount})
            </h2>
            <p className="text-xs text-muted-foreground">Aggregated and verified from official career portals</p>
          </div>

          {company.jobs.length === 0 ? (
            <div className="surface mt-4 p-8 text-center">
              <p className="text-sm text-muted-foreground">No current active positions recorded for {company.name}.</p>
            </div>
          ) : (
            <div className="mt-4 divide-y rounded-xl border bg-card">
              {company.jobs.map((job) => {
                const salary = formatSalary(job);
                const applicationUrl = safeExternalUrl(job.application_url);
                return (
                  <article key={job.id} className="p-4 transition-colors hover:bg-muted/15 sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/jobs/${job.id}`}
                          className="text-base font-semibold leading-6 tracking-tight hover:text-primary"
                        >
                          {job.title}
                        </Link>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          {job.location && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="size-3" />
                              {job.location}
                            </span>
                          )}
                          {job.employment_type && <span>{job.employment_type}</span>}
                          {job.seniority && <span>{job.seniority}</span>}
                          {salary && <span className="font-medium text-foreground">{salary}</span>}
                          {job.source && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase font-medium">
                              {job.source}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Link href={`/jobs/${job.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                          Review role <ArrowUpRight className="size-3.5" />
                        </Link>
                        <Link href={`/jobs/${job.id}/prepare`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          Prepare interview
                        </Link>
                        {applicationUrl && (
                          <a
                            href={applicationUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={buttonVariants({ size: "sm" })}
                            aria-label={`Apply for ${job.title} on company site`}
                          >
                            Apply <ExternalLink className="size-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
