import { equityDetails, formatEquity } from "@/lib/jobs/equity";
import { jobPosting, jsonLd } from "@/lib/public/discovery";
import { descriptionText, publicJob } from "@/lib/public/server";
import { getSiteUrl } from "@/lib/site-url";
import { safeExternalUrl } from "@/lib/utils";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const j = await publicJob(id);
  if (!j) notFound();
  return {
    title: `${j.title} at ${j.company_name || "an employer"}`,
    description: descriptionText(j.description).slice(0, 160),
    alternates: { canonical: `/opportunities/${id}` },
    robots: { index: j.source === "jobpilot", follow: true },
    openGraph: {
      title: j.title,
      description: `${j.company_name || "Employer"} · ${j.location || "Location not disclosed"}`,
      url: `/opportunities/${id}`,
    },
  };
}
export default async function Job({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const j = await publicJob(id);
  if (!j) notFound();
  const text = descriptionText(j.description),
    schema = jobPosting(j, text, getSiteUrl()),
    url = safeExternalUrl(j.application_url),
    source = safeExternalUrl(j.source_url);
  return (
    <article className="space-y-6">
      {schema && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd(schema) }}
        />
      )}
      <Link href="/opportunities" className="text-sm underline">
        Browse jobs
      </Link>
      <header>
        <p className="text-sm text-muted-foreground">
          {j.source === "jobpilot"
            ? "Verified Parth Careers employer"
            : `Source: ${j.source}`}
        </p>
        <h1 className="mt-2 break-words text-3xl font-bold">{j.title}</h1>
        <p className="mt-3 break-words">
          {j.company_name || "Company not disclosed"} ·{" "}
          {j.location || "Location not disclosed"}
        </p>
      </header>
      <div className="flex flex-wrap gap-3 text-sm">
        {j.employment_type && <span>{j.employment_type}</span>}
        {j.seniority && <span>{j.seniority}</span>}
        {j.salary_currency &&
          (j.salary_min != null || j.salary_max != null) && (
            <span>
              Disclosed annual salary: {j.salary_currency}{" "}
              {j.salary_min?.toLocaleString("en-US") || "Not disclosed"} –{" "}
              {j.salary_max?.toLocaleString("en-US") || "Not disclosed"}
            </span>
          )}
        <span>{formatEquity(equityDetails(j.description, j))}</span>
      </div>
      <section>
        <h2 className="text-xl font-semibold">Job description</h2>
        <p className="mt-3 whitespace-pre-wrap break-words leading-7">
          {text || "Read the full description at the original source."}
        </p>
      </section>
      <p className="break-words text-sm">{j.skills?.join(" · ")}</p>
      <div className="flex flex-wrap gap-4">
        {j.source === "jobpilot" ? (
          <Link
            href={`/auth/login?next=${encodeURIComponent(`/jobs/${id}`)}`}
            className="rounded-lg bg-primary px-5 py-3 text-primary-foreground"
          >
            Sign in to review & apply
          </Link>
        ) : (
          url && (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-primary px-5 py-3 text-primary-foreground"
            >
              Apply at original source ↗
            </a>
          )
        )}
        <Link
          href={`/auth/login?next=${encodeURIComponent(`/jobs/${id}`)}`}
          className="rounded-lg border px-5 py-3"
        >
          Save & check resume match
        </Link>
        {j.recruiter_company_id && (
          <Link
            href={`/employers/${j.recruiter_company_id}`}
            className="underline"
          >
            Employer profile
          </Link>
        )}
        {source && (
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Original listing
          </a>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Listing availability and employer claims can change. Never pay an
        application fee. Report suspicious listings after signing in, or contact
        support through Help.
      </p>
    </article>
  );
}
