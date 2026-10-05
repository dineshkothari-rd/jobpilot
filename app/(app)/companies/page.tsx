"use client";

import {
  ArrowUpRight, Bell, BellRing, Building2,
  MapPin, Search, Sparkles, X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type CompanySummary } from "@/lib/companies/service";
import { type FollowedCompanySummary } from "@/lib/companies/follows";
import { buttonVariants } from "@/components/ui/button";

function initials(name: string | null) {
  return name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "CO";
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [followed, setFollowed] = useState<FollowedCompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [viewTab, setViewTab] = useState<"all" | "following">("all");

  useEffect(() => {
    let ignore = false;
    async function loadAll() {
      try {
        setError("");
        const [compRes, follRes] = await Promise.all([
          fetch("/api/companies"),
          fetch("/api/companies/following"),
        ]);
        if (ignore) return;
        const compData = await compRes.json().catch(() => null);
        if (!compRes.ok) throw new Error(compData?.error || "Failed to load companies.");
        if (compData && Array.isArray(compData.companies)) {
          setCompanies(compData.companies);
        }
        if (follRes.ok) {
          const follData = await follRes.json().catch(() => null);
          if (follData && Array.isArray(follData.followedCompanies)) {
            setFollowed(follData.followedCompanies);
          }
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Unable to load company directory.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    }
    void loadAll();
    return () => {
      ignore = true;
    };
  }, []);

  const followedSlugs = useMemo(() => new Set(followed.map((f) => f.companySlug)), [followed]);
  const followedMap = useMemo(() => new Map(followed.map((f) => [f.companySlug, f])), [followed]);

  const filteredAll = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.domain && c.domain.toLowerCase().includes(q)) ||
      c.locations.some((loc) => loc.toLowerCase().includes(q)),
    );
  }, [companies, search]);

  const filteredFollowed = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return followed;
    return followed.filter((f) =>
      f.companyName.toLowerCase().includes(q) ||
      f.companySlug.toLowerCase().includes(q),
    );
  }, [followed, search]);

  const unfollowCompany = async (slug: string) => {
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(slug)}/follow`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFollowed((prev) => prev.filter((f) => f.companySlug !== slug));
      }
    } catch (err) {
      console.error("Failed to unfollow:", err);
    }
  };

  return (
    <div className="min-h-screen pb-12">
      <div className="mx-auto w-full max-w-[1440px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
        <header className="animate-float-in">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="size-4" />
            </span>
            <p className="section-label">Employers &amp; Organizations</p>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-[34px]">
            Company Directory
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground sm:text-[15px]">
            Explore verified employers hiring across remote hubs, India, and global markets. Follow companies you love to receive instant alerts when new roles open.
          </p>
        </header>

        {/* Tab & Search controls */}
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 border-b border-border/60 pb-1 sm:border-0 sm:pb-0">
            <button
              type="button"
              onClick={() => setViewTab("all")}
              className={`rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${viewTab === "all" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              All Companies ({companies.length})
            </button>
            <button
              type="button"
              onClick={() => setViewTab("following")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition ${viewTab === "following" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              <BellRing className="size-3.5" />
              Following ({followed.length})
            </button>
          </div>

          <div className="relative w-full sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies…"
              aria-label="Search companies"
              className="h-10 w-full rounded-xl border bg-background pl-10 pr-9 text-xs outline-none transition focus:ring-2 focus:ring-ring/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Directory Grid */}
        <section className="mt-6" aria-label="Company directory">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 9 }, (_, i) => (
                <div key={i} className="surface p-5">
                  <div className="size-10 animate-pulse rounded-lg bg-muted" />
                  <div className="mt-3 h-5 w-3/4 animate-pulse rounded bg-muted" />
                  <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-muted" />
                </div>
              ))}
            </div>
          ) : viewTab === "all" ? (
            filteredAll.length === 0 ? (
              <div className="surface p-12 text-center">
                <Building2 className="mx-auto size-10 text-muted-foreground/40" />
                <h2 className="mt-3 text-lg font-bold">No companies found</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {search ? `No companies matching "${search}". Try a different keyword.` : "No companies available currently."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredAll.map((company) => {
                  const isFollowed = followedSlugs.has(company.slug);
                  const followInfo = followedMap.get(company.slug);
                  return (
                    <article
                      key={company.slug}
                      className="surface group flex flex-col justify-between p-5 transition-colors hover:border-primary/40 hover:bg-muted/10"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground">
                            {initials(company.name)}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                              <Sparkles className="size-3" />
                              {company.jobCount} {company.jobCount === 1 ? "opening" : "openings"}
                            </span>
                            {isFollowed && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                <BellRing className="size-2.5" /> Following
                              </span>
                            )}
                          </div>
                        </div>

                        <h2 className="mt-3 font-semibold text-foreground group-hover:text-primary">
                          <Link href={`/companies/${company.slug}`} className="hover:underline">
                            {company.name}
                          </Link>
                        </h2>

                        {company.domain && (
                          <p className="mt-0.5 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <span>{company.domain}</span>
                          </p>
                        )}

                        {followInfo && followInfo.newOpeningsLast7Days > 0 && (
                          <div className="mt-2 inline-flex items-center gap-1 rounded bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400">
                            <span>⚡ {followInfo.newOpeningsLast7Days} new this week</span>
                          </div>
                        )}

                        {company.locations.length > 0 && (
                          <div className="mt-2.5 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="size-3 shrink-0 text-muted-foreground/70" />
                            <span className="truncate">{company.locations.join(" · ")}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-5 border-t pt-3">
                        <Link
                          href={`/companies/${company.slug}`}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                        >
                          View profile &amp; jobs <ArrowUpRight className="size-3.5" />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            )
          ) : (
            /* Following tab */
            filteredFollowed.length === 0 ? (
              <div className="surface p-12 text-center">
                <Bell className="mx-auto size-10 text-muted-foreground/40" />
                <h2 className="mt-3 text-lg font-bold">
                  {search ? `No followed companies match "${search}"` : "You haven't followed any companies yet"}
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                  Follow employers you&apos;d love to work for. We&apos;ll monitor their hiring pipeline and alert you the moment new roles are posted.
                </p>
                <div className="mt-6">
                  <button
                    type="button"
                    onClick={() => setViewTab("all")}
                    className={buttonVariants({ size: "sm" })}
                  >
                    Browse all companies
                  </button>
                </div>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {filteredFollowed.map((item) => (
                  <article
                    key={item.companySlug}
                    className="surface group flex flex-col justify-between p-5 transition-colors hover:border-primary/40 hover:bg-muted/10"
                  >
                    <div>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground">
                          {initials(item.companyName)}
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                            <Sparkles className="size-3" />
                            {item.totalOpenings} {item.totalOpenings === 1 ? "opening" : "openings"}
                          </span>
                          {item.newOpeningsLast7Days > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                              ⚡ {item.newOpeningsLast7Days} new this week
                            </span>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              Up to date
                            </span>
                          )}
                        </div>
                      </div>

                      <h2 className="mt-3 font-semibold text-foreground group-hover:text-primary">
                        <Link href={`/companies/${item.companySlug}`} className="hover:underline">
                          {item.companyName}
                        </Link>
                      </h2>

                      <p className="mt-1 text-xs text-muted-foreground">
                        Alerts enabled · Followed {new Date(item.followedAt).toLocaleDateString()}
                      </p>
                    </div>

                    <div className="mt-5 flex items-center justify-between border-t pt-3">
                      <Link
                        href={`/companies/${item.companySlug}`}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                      >
                        View profile &amp; jobs <ArrowUpRight className="size-3.5" />
                      </Link>
                      <button
                        type="button"
                        onClick={() => void unfollowCompany(item.companySlug)}
                        className="text-xs text-muted-foreground hover:text-destructive"
                      >
                        Unfollow
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )
          )}
        </section>
      </div>
    </div>
  );
}
