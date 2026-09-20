import "server-only";
import type { ServerSupabaseClient } from "@/lib/supabase/server";
import { safeExternalUrl } from "@/lib/utils";

const HIMALAYAS_SEARCH_URL =
  "https://himalayas.app/jobs/api/search";

type HimalayasJob = {
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

type HimalayasResponse = {
  jobs?: HimalayasJob[];
  totalCount?: number;
};

const text = (value: unknown) => typeof value === "string" ? value.trim() : "";
const amount = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;

function normalizeCompanyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function parseDate(value?: unknown) {
  if (value == null) {
    return null;
  }

  if (typeof value === "number") {
    const milliseconds =
      value < 100000000000
        ? value * 1000
        : value;

    const date = new Date(milliseconds);

    return Number.isNaN(date.getTime())
      ? null
      : date.toISOString();
  }

  if (typeof value !== "string") return null;
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

function normalizeEmploymentType(value?: unknown) {
  if (typeof value !== "string" || !value) {
    return null;
  }

  const normalized = value.toLowerCase().trim();

  if (normalized === "full time") {
    return "full-time";
  }

  if (normalized === "part time") {
    return "part-time";
  }

  if (normalized === "contractor") {
    return "contract";
  }

  if (normalized === "temporary") {
    return "temporary";
  }

  if (normalized === "intern") {
    return "internship";
  }

  return normalized;
}

function getCountryCode(country: string) {
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

async function fetchJobs(
  query: string,
  country?: string,
) {
  const url = new URL(HIMALAYAS_SEARCH_URL);

  url.searchParams.set("q", query);
  url.searchParams.set("sort", "recent");
  url.searchParams.set("page", "1");

  if (country) {
    url.searchParams.set(
      "country",
      getCountryCode(country),
    );
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(
      `Himalayas API returned ${response.status}.`,
    );
  }

  const result: unknown = await response.json();
  if (!result || typeof result !== "object") throw new Error("Himalayas returned an invalid response.");

  const jobs = (result as HimalayasResponse).jobs;
  return { jobs: Array.isArray(jobs) ? jobs.filter((job) => job && typeof job === "object") : [] };
}

export async function syncJobs(supabase: ServerSupabaseClient, userId: string, targetRoles: string[] = []) {

    const [
      { data: profile, error: profileError },
      { data: preferences, error: preferencesError },
    ] = await Promise.all([
      supabase
        .from("profiles")
        .select(
          "current_company,target_role,location",
        )
        .eq("id", userId)
        .single(),

      supabase
        .from("job_preferences")
        .select(
          "preferred_roles,preferred_locations,remote_only,employment_types,minimum_salary,preferred_countries",
        )
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    if (profileError) {
      throw new Error(
        `Failed to load profile: ${profileError.message}`,
      );
    }

    if (preferencesError) {
      throw new Error(
        `Failed to load preferences: ${preferencesError.message}`,
      );
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

    const countries =
      preferences?.preferred_countries?.filter(Boolean) ||
      [];

    const country =
      countries.length > 0
        ? countries[0]
        : undefined;

    const currentCompany =
      profile?.current_company?.trim() || "";

    const excludedCompany =
      normalizeCompanyName(currentCompany);

    const fetchedJobs: HimalayasJob[] = [];

    const results = await Promise.all(roles.map((role) => fetchJobs(role, country)));
    fetchedJobs.push(...results.flatMap((result) => result.jobs || []));

    const uniqueJobs = new Map<
      string,
      HimalayasJob
    >();

    for (const job of fetchedJobs) {
      const externalId = text(job.guid);

      const companyName = text(job.companyName);

      if (!externalId || !text(job.title)) {
        continue;
      }

      if (
        excludedCompany &&
        normalizeCompanyName(companyName) ===
          excludedCompany
      ) {
        continue;
      }

      uniqueJobs.set(externalId, job);
    }

    const rows = Array.from(
      uniqueJobs.values(),
    ).map((job) => {
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
        external_id: job.guid,
        title: text(job.title),
        company_name:
          text(job.companyName) ||
          "Unknown Company",
        description:
          text(job.description).slice(0, 250_000) ||
          text(job.excerpt).slice(0, 250_000) ||
          "",
        location:
          locationRestrictions.length > 0
            ? locationRestrictions.join(", ")
            : "Worldwide",
        country:
          locationRestrictions[0] ||
          null,
        employment_type:
          normalizeEmploymentType(
            job.employmentType,
          ),
        seniority:
          typeof job.seniority === "string"
            ? job.seniority.trim() || null
            : Array.isArray(job.seniority)
              ? job.seniority.join(", ")
              : null,
        salary_min: amount(job.minSalary),
        salary_max: amount(job.maxSalary),
        salary_currency:
          text(job.currency).slice(0, 10) || null,
        application_url: safeExternalUrl(job.applicationLink),
        source_url: safeExternalUrl(job.applicationLink),
        source: "himalayas",
        published_at:
          parseDate(job.pubDate),
        expires_at:
          parseDate(job.expiryDate),
        skills,
        raw_data: job,
      };
    });

    if (rows.length === 0) {
      return {
        success: true,
        fetched: fetchedJobs.length,
        filtered: 0,
        upserted: 0,
        message:
          "No matching jobs found.",
      };
    }

    const { data: savedJobs, error: upsertError } =
      await supabase
        .from("jobs")
        .upsert(rows, {
          onConflict: "external_id",
        })
        .select("id");

    if (upsertError) {
      throw new Error(
        `Failed to save jobs: ${upsertError.message}`,
      );
    }

    return {
      success: true,
      roles,
      country: country || null,
      excluded_company:
        currentCompany || null,
      fetched: fetchedJobs.length,
      filtered: rows.length,
      upserted: savedJobs?.length || 0,
    };
}
