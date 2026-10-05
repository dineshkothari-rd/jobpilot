"use client";

import {
  ArrowUpRight, Building2,
  MapPin, Search, Sparkles, X,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { type CompanySummary } from "@/lib/companies/service";

function initials(name: string | null) {
  return name?.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase() || "CO";
}

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<CompanySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch("/api/companies");
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Failed to load companies.");
        if (data && Array.isArray(data.companies)) {
          setCompanies(data.companies);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load company directory.");
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return companies;
    return companies.filter((c) =>
      c.name.toLowerCase().includes(q) ||
      (c.domain && c.domain.toLowerCase().includes(q)) ||
      c.locations.some((loc) => loc.toLowerCase().includes(q)),
    );
  }, [companies, search]);

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
            Explore verified employers hiring across remote hubs, India, and global markets. Discover roles, hiring trends, and company-specific openings.
          </p>
        </header>

        {/* Search */}
        <div className="mt-6 flex max-w-md items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search companies by name or city…"
              aria-label="Search companies"
              className="h-11 w-full rounded-xl border bg-background pl-10 pr-9 text-sm outline-none transition focus:ring-2 focus:ring-ring/40"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2.5 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
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
          ) : filtered.length === 0 ? (
            <div className="surface p-12 text-center">
              <Building2 className="mx-auto size-10 text-muted-foreground/40" />
              <h2 className="mt-3 text-lg font-bold">No companies found</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {search ? `No companies matching "${search}". Try a different keyword.` : "No companies available currently."}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((company) => (
                <article
                  key={company.slug}
                  className="surface group flex flex-col justify-between p-5 transition-colors hover:border-primary/40 hover:bg-muted/10"
                >
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-bold text-muted-foreground">
                        {initials(company.name)}
                      </div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        <Sparkles className="size-3" />
                        {company.jobCount} {company.jobCount === 1 ? "opening" : "openings"}
                      </span>
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
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
