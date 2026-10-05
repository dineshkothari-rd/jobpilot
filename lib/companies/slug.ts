/**
 * Utilities for company slug generation and normalization.
 */

export function companyToSlug(name?: string | null): string {
  if (!name || typeof name !== "string") return "unknown-company";
  const normalized = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // Strip accents
    .replace(/[^\w\s-]/g, "") // Remove non-word chars except spaces & dashes
    .replace(/\s+/g, "-") // Replace spaces with dashes
    .replace(/-+/g, "-") // Collapse consecutive dashes
    .replace(/^-+|-+$/g, ""); // Trim leading & trailing dashes

  return normalized || "unknown-company";
}

export function slugToSearchTerm(slug?: string | null): string {
  if (!slug || typeof slug !== "string") return "";
  return slug
    .trim()
    .toLowerCase()
    .replace(/-/g, " ")
    .trim();
}

const JOB_BOARD_DOMAINS = new Set([
  "himalayas.app",
  "remotive.com",
  "remotive.io",
  "arbeitnow.com",
  "linkedin.com",
  "indeed.com",
  "glassdoor.com",
  "greenhouse.io",
  "lever.co",
  "workable.com",
  "ashbyhq.com",
]);

export function extractCompanyDomain(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  try {
    const parsed = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!host.includes(".") || JOB_BOARD_DOMAINS.has(host) || host.endsWith(".jobpilot.app")) {
      return null;
    }
    return host;
  } catch {
    return null;
  }
}
