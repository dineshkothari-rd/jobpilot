import { discoveryFilters } from "@/lib/public/discovery";
import { publicJobs } from "@/lib/public/server";
import type { Metadata } from "next";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Browse jobs",
  robots: { index: false, follow: true },
  description:
    "Browse active jobs from public sources and verified JobPilot employers. Read listings without signing in.",
  alternates: { canonical: "/opportunities" },
};
export default async function Opportunities({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let filters;
  try {
    filters = discoveryFilters(await searchParams);
  } catch {
    return (
      <p role="alert">
        Invalid search.{" "}
        <Link href="/opportunities" className="underline">
          Start a new search
        </Link>
      </p>
    );
  }
  const { jobs, more } = await publicJobs(
    filters.q,
    filters.location,
    filters.page,
  );
  const pageLink = (page: number) =>
    "/opportunities?" +
    new URLSearchParams({
      q: filters.q,
      location: filters.location,
      page: String(page),
    });
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Find your next opportunity</h1>
        <p className="mt-3 text-muted-foreground">
          Browse first. Sign in to save, match your resume or apply to a
          JobPilot employer.
        </p>
      </header>
      <form className="flex flex-wrap items-end gap-3">
        <label className="min-w-0 flex-1 text-sm">
          Job title
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            className="mt-1 w-full rounded-lg border p-3"
          />
        </label>
        <label className="min-w-0 flex-1 text-sm">
          Location
          <input
            name="location"
            defaultValue={filters.location}
            maxLength={100}
            className="mt-1 w-full rounded-lg border p-3"
          />
        </label>
        <button className="rounded-lg bg-primary px-5 py-3 text-primary-foreground">
          Search jobs
        </button>
      </form>
      <div className="grid gap-4 sm:grid-cols-2">
        {jobs.map((j) => (
          <article key={j.id} className="min-w-0 rounded-xl border p-5">
            <h2 className="break-words text-lg font-semibold">
              <Link href={`/opportunities/${j.id}`} className="hover:underline">
                {j.title}
              </Link>
            </h2>
            <p className="mt-2 break-words">
              {j.company_name || "Company not disclosed"} ·{" "}
              {j.location || "Location not disclosed"}
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {j.source === "jobpilot"
                ? "Verified JobPilot employer"
                : `Source: ${j.source}`}
            </p>
          </article>
        ))}
      </div>
      {!jobs.length && <p>No active jobs match this search.</p>}
      <nav aria-label="Job result pages" className="flex flex-wrap gap-5">
        {filters.page > 1 && (
          <Link href={pageLink(filters.page - 1)} className="underline">
            Previous page
          </Link>
        )}
        <span>Page {filters.page}</span>
        {more && filters.page < 100 && (
          <Link href={pageLink(filters.page + 1)} className="underline">
            Next page
          </Link>
        )}
      </nav>
    </div>
  );
}
