import "server-only";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { safeExternalUrl } from "@/lib/utils";

export const HIMALAYAS_SEARCH_URL = "https://himalayas.app/jobs/api/search";
export const REMOTIVE_API_URL = "https://remotive.com/api/remote-jobs";
export const ARBEITNOW_API_URL = "https://www.arbeitnow.com/api/job-board-api";

export type HimalayasJob = {
  guid?: string;
  title?: string;
  companyName?: string;
  companySlug?: string;
  excerpt?: string;
  description?: string;
  employmentType?: string;
  minSalary?: number | null;
  maxSalary?: number | null;
  salaryPeriod?: string;
  currency?: string;
  seniority?: string | string[];
  locationRestrictions?: string[];
  timezoneRestrictions?: string[];
  categories?: string[];
  parentCategories?: string[];
  pubDate?: string | number;
  expiryDate?: string | number;
  applicationLink?: string;
};

export type RemotiveJob = {
  id?: number | string;
  url?: string;
  title?: string;
  company_name?: string;
  company_logo?: string;
  category?: string;
  tags?: string[];
  job_type?: string;
  publication_date?: string;
  candidate_required_location?: string;
  salary?: string;
  description?: string;
};

export type ArbeitnowJob = {
  slug?: string;
  company_name?: string;
  title?: string;
  description?: string;
  remote?: boolean;
  url?: string;
  tags?: string[];
  job_types?: string[];
  location?: string;
  created_at?: number;
};

export type NormalizedJobRow = {
  external_id: string;
  title: string;
  company_name: string;
  description: string;
  location: string;
  country: string | null;
  employment_type: string | null;
  seniority: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  application_url: string | null;
  source_url: string | null;
  source: string;
  published_at: string | null;
  expires_at: string | null;
  skills: string[];
  raw_data: Record<string, unknown>;
};

export const text = (value: unknown): string => typeof value === "string" ? value.trim() : "";
export const amount = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) ? value : null;

export function normalizeCompanyName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function parseDate(value?: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    const milliseconds = value < 100_000_000_000 ? value * 1000 : value;
    const date = new Date(milliseconds);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeEmploymentType(value?: unknown): string | null {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const normalized = value.toLowerCase().trim().replace(/[_-\s]+/g, "-");

  if (normalized.includes("full") && normalized.includes("time")) {
    return "full-time";
  }
  if (normalized.includes("part") && normalized.includes("time")) {
    return "part-time";
  }
  if (normalized.includes("contract") || normalized.includes("freelance")) {
    return "contract";
  }
  if (normalized.includes("intern")) {
    return "internship";
  }
  if (normalized.includes("temp")) {
    return "temporary";
  }

  return normalized;
}

export function parseSalaryString(raw?: unknown): { min: number | null; max: number | null; currency: string | null } {
  if (typeof raw !== "string" || !raw.trim()) {
    return { min: null, max: null, currency: null };
  }
  const str = raw.trim();
  let currency: string | null = null;
  if (str.includes("€") || /\beur\b/i.test(str)) currency = "EUR";
  else if (str.includes("£") || /\bgbp\b/i.test(str)) currency = "GBP";
  else if (str.includes("₹") || /\binr\b/i.test(str)) currency = "INR";
  else if (str.includes("$") || /\busd\b/i.test(str)) currency = "USD";

  const matches = Array.from(str.matchAll(/(\d[\d,.]*)\s*(k)?/gi));
  const values: number[] = [];
  for (const m of matches) {
    const rawDigits = m[1].replace(/,/g, "");
    let num = parseFloat(rawDigits);
    if (!Number.isFinite(num)) continue;
    if (m[2] && m[2].toLowerCase() === "k") {
      num *= 1000;
    }
    if (num >= 500 && num < 100_000_000) {
      values.push(Math.round(num));
    }
  }

  if (values.length === 1) {
    return { min: values[0], max: null, currency: currency || "USD" };
  }
  if (values.length >= 2) {
    values.sort((a, b) => a - b);
    return { min: values[0], max: values[values.length - 1], currency: currency || "USD" };
  }
  return { min: null, max: null, currency };
}

export function getCountryCode(country: string): string {
  const normalized = country.trim().toLowerCase();

  const countries: Record<string, string> = {
    india: "IN",
    "united states": "US",
    usa: "US",
    "united kingdom": "GB",
    uk: "GB",
    canada: "CA",
    australia: "AU",
    germany: "DE",
    france: "FR",
    netherlands: "NL",
    singapore: "SG",
    ireland: "IE",
    "new zealand": "NZ",
    spain: "ES",
    portugal: "PT",
    sweden: "SE",
    norway: "NO",
    denmark: "DK",
    finland: "FI",
    switzerland: "CH",
    poland: "PL",
    belgium: "BE",
    austria: "AT",
  };

  return countries[normalized] || country.trim();
}

export function normalizeHimalayasJob(job: HimalayasJob): NormalizedJobRow | null {
  const externalId = text(job.guid);
  const title = text(job.title);
  if (!externalId || !title) return null;

  const locationRestrictions = Array.isArray(job.locationRestrictions)
    ? job.locationRestrictions.filter((item): item is string => typeof item === "string")
    : [];

  const skills = Array.from(
    new Set([
      ...(Array.isArray(job.categories) ? job.categories.filter((item): item is string => typeof item === "string") : []),
      ...(Array.isArray(job.parentCategories) ? job.parentCategories.filter((item): item is string => typeof item === "string") : []),
    ]),
  );

  return {
    external_id: externalId,
    title,
    company_name: text(job.companyName) || "Unknown Company",
    description: text(job.description).slice(0, 250_000) || text(job.excerpt).slice(0, 250_000) || "",
    location: locationRestrictions.length > 0 ? locationRestrictions.join(", ") : "Worldwide",
    country: locationRestrictions[0] || null,
    employment_type: normalizeEmploymentType(job.employmentType),
    seniority:
      typeof job.seniority === "string"
        ? job.seniority.trim() || null
        : Array.isArray(job.seniority)
          ? job.seniority.join(", ")
          : null,
    salary_min: amount(job.minSalary),
    salary_max: amount(job.maxSalary),
    salary_currency: text(job.currency).slice(0, 10) || null,
    application_url: safeExternalUrl(job.applicationLink),
    source_url: safeExternalUrl(job.applicationLink),
    source: "himalayas",
    published_at: parseDate(job.pubDate),
    expires_at: parseDate(job.expiryDate),
    skills,
    raw_data: (job && typeof job === "object" ? job : {}) as Record<string, unknown>,
  };
}

export function normalizeRemotiveJob(job: RemotiveJob): NormalizedJobRow | null {
  const rawId = job.id != null ? String(job.id).trim() : "";
  const title = text(job.title);
  if (!rawId || !title) return null;

  const externalId = `remotive-${rawId}`;
  const salary = parseSalaryString(job.salary);
  const location = text(job.candidate_required_location) || "Worldwide";
  const skills = Array.from(
    new Set([
      ...(Array.isArray(job.tags) ? job.tags.filter((item): item is string => typeof item === "string") : []),
      ...(typeof job.category === "string" && job.category.trim() ? [job.category.trim()] : []),
    ]),
  );

  return {
    external_id: externalId,
    title,
    company_name: text(job.company_name) || "Unknown Company",
    description: text(job.description).slice(0, 250_000) || "",
    location,
    country: location !== "Worldwide" ? location : null,
    employment_type: normalizeEmploymentType(job.job_type),
    seniority: null,
    salary_min: salary.min,
    salary_max: salary.max,
    salary_currency: salary.currency,
    application_url: safeExternalUrl(job.url),
    source_url: safeExternalUrl(job.url),
    source: "remotive",
    published_at: parseDate(job.publication_date),
    expires_at: null,
    skills,
    raw_data: (job && typeof job === "object" ? job : {}) as Record<string, unknown>,
  };
}

export function normalizeArbeitnowJob(job: ArbeitnowJob): NormalizedJobRow | null {
  const slug = text(job.slug);
  const title = text(job.title);
  if (!slug || !title) return null;

  const externalId = `arbeitnow-${slug}`;
  const skills = Array.isArray(job.tags) ? job.tags.filter((item): item is string => typeof item === "string") : [];
  const primaryJobType = Array.isArray(job.job_types) && job.job_types.length > 0 ? job.job_types[0] : null;
  const location = text(job.location) || (job.remote ? "Remote" : "Worldwide");

  return {
    external_id: externalId,
    title,
    company_name: text(job.company_name) || "Unknown Company",
    description: text(job.description).slice(0, 250_000) || "",
    location,
    country: null,
    employment_type: normalizeEmploymentType(primaryJobType),
    seniority: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    application_url: safeExternalUrl(job.url),
    source_url: safeExternalUrl(job.url),
    source: "arbeitnow",
    published_at: parseDate(job.created_at),
    expires_at: null,
    skills,
    raw_data: (job && typeof job === "object" ? job : {}) as Record<string, unknown>,
  };
}

export function deduplicateJobs(jobs: NormalizedJobRow[], excludedCompany?: string): NormalizedJobRow[] {
  const seenIds = new Set<string>();
  const seenUrls = new Set<string>();
  const seenSignatures = new Set<string>();
  const result: NormalizedJobRow[] = [];

  const normalizedExcluded = excludedCompany ? normalizeCompanyName(excludedCompany) : "";

  for (const job of jobs) {
    if (!job.external_id || !job.title) continue;

    const normalizedCompany = normalizeCompanyName(job.company_name);
    if (
      normalizedExcluded &&
      (normalizedCompany === normalizedExcluded ||
       normalizedCompany.startsWith(normalizedExcluded) ||
       normalizedExcluded.startsWith(normalizedCompany))
    ) {
      continue;
    }

    if (seenIds.has(job.external_id)) continue;
    seenIds.add(job.external_id);

    if (job.application_url) {
      const canonicalUrl = job.application_url.toLowerCase().replace(/\/+$/, "");
      if (seenUrls.has(canonicalUrl)) continue;
      seenUrls.add(canonicalUrl);
    }

    const signature = `${normalizeCompanyName(job.company_name)}::${job.title.toLowerCase().trim()}`;
    if (seenSignatures.has(signature)) continue;
    seenSignatures.add(signature);

    result.push(job);
  }

  return result;
}

export async function fetchHimalayasJobs(query: string, country?: string): Promise<NormalizedJobRow[]> {
  const url = new URL(HIMALAYAS_SEARCH_URL);
  url.searchParams.set("q", query);
  url.searchParams.set("sort", "recent");
  url.searchParams.set("page", "1");

  if (country) {
    url.searchParams.set("country", getCountryCode(country));
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Himalayas API returned ${response.status}.`);
  }

  const result: unknown = await response.json();
  if (!result || typeof result !== "object") throw new Error("Himalayas returned an invalid response.");

  const jobs = (result as { jobs?: HimalayasJob[] }).jobs;
  if (!Array.isArray(jobs)) return [];

  return jobs
    .map((j) => normalizeHimalayasJob(j))
    .filter((j): j is NormalizedJobRow => j !== null);
}

export async function fetchRemotiveJobs(query: string): Promise<NormalizedJobRow[]> {
  const url = new URL(REMOTIVE_API_URL);
  url.searchParams.set("search", query);
  url.searchParams.set("limit", "25");

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Remotive API returned ${response.status}.`);
  }

  const result: unknown = await response.json();
  if (!result || typeof result !== "object") throw new Error("Remotive returned an invalid response.");

  const jobs = (result as { jobs?: RemotiveJob[] }).jobs;
  if (!Array.isArray(jobs)) return [];

  return jobs
    .map((j) => normalizeRemotiveJob(j))
    .filter((j): j is NormalizedJobRow => j !== null);
}

export async function fetchArbeitnowJobs(query: string): Promise<NormalizedJobRow[]> {
  const url = new URL(ARBEITNOW_API_URL);

  const response = await fetch(url.toString(), {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Arbeitnow API returned ${response.status}.`);
  }

  const result: unknown = await response.json();
  if (!result || typeof result !== "object") throw new Error("Arbeitnow returned an invalid response.");

  const jobs = (result as { data?: ArbeitnowJob[] }).data;
  if (!Array.isArray(jobs)) return [];

  const lowerQuery = query.toLowerCase().trim();
  const matched = jobs.filter((j) => {
    if (!j || typeof j !== "object") return false;
    const titleMatch = (j.title || "").toLowerCase().includes(lowerQuery);
    const tagsMatch = Array.isArray(j.tags) && j.tags.some((t) => typeof t === "string" && t.toLowerCase().includes(lowerQuery));
    return titleMatch || tagsMatch;
  });

  return matched
    .map((j) => normalizeArbeitnowJob(j))
    .filter((j): j is NormalizedJobRow => j !== null);
}

export async function syncJobs(
  supabase: ServerSupabaseClient,
  userId: string,
  targetRoles: string[] = [],
  enabledSources: string[] = ["himalayas", "remotive", "arbeitnow"],
) {
  const [
    { data: profile, error: profileError },
    { data: preferences, error: preferencesError },
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("current_company,target_role,location")
      .eq("id", userId)
      .single(),

    supabase
      .from("job_preferences")
      .select("preferred_roles,preferred_locations,remote_only,employment_types,minimum_salary,preferred_countries")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  if (profileError) {
    throw new Error(`Failed to load profile: ${profileError.message}`);
  }

  if (preferencesError) {
    throw new Error(`Failed to load preferences: ${preferencesError.message}`);
  }

  const roles = Array.from(
    new Set(
      [
        ...targetRoles,
        ...(preferences?.preferred_roles || []),
        profile?.target_role || "",
      ]
        .map((role) => role.trim())
        .filter(Boolean),
    ),
  ).slice(0, 3);

  if (roles.length === 0) {
    throw new Error("No preferred roles configured. Add at least one role in Profile.");
  }

  const countries = preferences?.preferred_countries?.filter(Boolean) || [];
  const country = countries.length > 0 ? countries[0] : undefined;
  const currentCompany = profile?.current_company?.trim() || "";

  const fetchTasks: Promise<{ source: string; jobs: NormalizedJobRow[] }>[] = [];

  for (const role of roles) {
    if (enabledSources.includes("himalayas")) {
      fetchTasks.push(
        fetchHimalayasJobs(role, country)
          .then((jobs) => ({ source: "himalayas", jobs }))
          .catch((err) => {
            return Promise.reject(new Error(`Himalayas (${role}): ${err.message}`));
          }),
      );
    }
    if (enabledSources.includes("remotive")) {
      fetchTasks.push(
        fetchRemotiveJobs(role)
          .then((jobs) => ({ source: "remotive", jobs }))
          .catch((err) => {
            return Promise.reject(new Error(`Remotive (${role}): ${err.message}`));
          }),
      );
    }
    if (enabledSources.includes("arbeitnow")) {
      fetchTasks.push(
        fetchArbeitnowJobs(role)
          .then((jobs) => ({ source: "arbeitnow", jobs }))
          .catch((err) => {
            return Promise.reject(new Error(`Arbeitnow (${role}): ${err.message}`));
          }),
      );
    }
  }

  const settled = await Promise.allSettled(fetchTasks);
  const collectedJobs: NormalizedJobRow[] = [];
  const sourceStats: Record<string, number> = {
    himalayas: 0,
    remotive: 0,
    arbeitnow: 0,
  };
  const syncErrors: string[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      const { source, jobs } = result.value;
      collectedJobs.push(...jobs);
      sourceStats[source] = (sourceStats[source] || 0) + jobs.length;
    } else {
      syncErrors.push(result.reason instanceof Error ? result.reason.message : String(result.reason));
    }
  }

  const deduplicated = deduplicateJobs(collectedJobs, currentCompany);

  if (deduplicated.length === 0) {
    return {
      success: true,
      roles,
      country: country || null,
      excluded_company: currentCompany || null,
      fetched: collectedJobs.length,
      filtered: 0,
      upserted: 0,
      by_source: sourceStats,
      errors: syncErrors.length > 0 ? syncErrors : undefined,
      message: "No matching jobs found.",
    };
  }

  const { data: savedJobs, error: upsertError } = await supabase
    .from("jobs")
    .upsert(deduplicated, {
      onConflict: "external_id",
    })
    .select("id");

  if (upsertError) {
    throw new Error(`Failed to save jobs: ${upsertError.message}`);
  }

  return {
    success: true,
    roles,
    country: country || null,
    excluded_company: currentCompany || null,
    fetched: collectedJobs.length,
    filtered: deduplicated.length,
    upserted: savedJobs?.length || 0,
    by_source: sourceStats,
    errors: syncErrors.length > 0 ? syncErrors : undefined,
  };
}
