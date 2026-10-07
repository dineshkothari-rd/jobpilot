export type PublicJob = {
  id: string;
  title: string;
  company_name: string | null;
  description: string | null;
  location: string | null;
  country: string | null;
  employment_type: string | null;
  seniority: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  skills: string[] | null;
  application_url: string | null;
  source_url: string | null;
  source: string;
  published_at: string | null;
  expires_at: string | null;
  recruiter_company_id: string | null;
  equity_min: number | null;
  equity_max: number | null;
};
export function discoveryFilters(
  values: Record<string, string | string[] | undefined>,
) {
  const text = (key: string) => {
    const v = values[key];
    if (Array.isArray(v) || (typeof v === "string" && v.length > 100))
      throw Error("Search terms must be at most 100 characters.");
    return v?.trim() || "";
  };
  const page = text("page") || "1";
  if (!/^\d{1,3}$/.test(page) || Number(page) < 1 || Number(page) > 100)
    throw Error("Choose a page between 1 and 100.");
  // Search uses escaped LIKE literals, never a raw PostgREST OR expression.
  return { q: text("q"), location: text("location"), page: Number(page) };
}
export function likeLiteral(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}
export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
export function jobPosting(
  job: PublicJob,
  description: string,
  origin: string,
) {
  // Source-backed direct jobs only; omit markup when location/date facts are incomplete.
  if (
    job.source !== "jobpilot" ||
    !job.company_name ||
    !job.country ||
    !job.location ||
    !description.trim() ||
    !job.published_at ||
    !Number.isFinite(Date.parse(job.published_at)) ||
    (job.expires_at && Date.parse(job.expires_at) <= Date.now())
  )
    return null;
  const remote = /^(remote|work from home)$/i.test(job.location.trim());
  // Mixed/ambiguous location text is not a physical locality or a remote eligibility claim.
  if (/remote|worldwide|hybrid/i.test(job.location) && !remote) return null;
  const html =
    "<p>" +
    description
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "</p><p>") +
    "</p>";
  return {
    "@context": "https://schema.org",
    "@type": "JobPosting",
    title: job.title,
    description: html,
    datePosted: job.published_at,
    hiringOrganization: { "@type": "Organization", name: job.company_name },
    url: `${origin}/opportunities/${job.id}`,
    ...(remote
      ? {
          jobLocationType: "TELECOMMUTE",
          applicantLocationRequirements: {
            "@type": "Country",
            name: job.country,
          },
        }
      : {
          jobLocation: {
            "@type": "Place",
            address: {
              "@type": "PostalAddress",
              addressLocality: job.location,
              addressCountry: job.country,
            },
          },
        }),
    ...(job.expires_at ? { validThrough: job.expires_at } : {}),
  };
}
