import { createClient } from "@/lib/supabase/server";
import { companyToSlug, extractCompanyDomain, slugToSearchTerm } from "./slug";

export interface CompanySummary {
  name: string;
  slug: string;
  jobCount: number;
  locations: string[];
  domain: string | null;
}

export interface CompanyDetail {
  name: string;
  slug: string;
  jobCount: number;
  locations: string[];
  countries: string[];
  employmentTypes: string[];
  skills: string[];
  domain: string | null;
  jobs: Array<{
    id: string;
    title: string;
    location: string | null;
    employment_type: string | null;
    seniority: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    application_url: string | null;
    source: string | null;
    published_at: string | null;
    skills: string[] | null;
  }>;
}

export async function listCompanies(): Promise<CompanySummary[]> {
  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("jobs")
    .select("company_name, location, application_url, source_url")
    .not("company_name", "is", null);

  if (error || !rows) {
    return [];
  }

  const map = new Map<string, {
    name: string;
    slug: string;
    jobCount: number;
    locations: Set<string>;
    domain: string | null;
  }>();

  for (const row of rows) {
    const rawName = row.company_name?.trim();
    if (!rawName) continue;
    const slug = companyToSlug(rawName);

    let entry = map.get(slug);
    if (!entry) {
      entry = {
        name: rawName,
        slug,
        jobCount: 0,
        locations: new Set(),
        domain: extractCompanyDomain(row.application_url) || extractCompanyDomain(row.source_url),
      };
      map.set(slug, entry);
    }

    entry.jobCount += 1;
    if (row.location?.trim()) {
      entry.locations.add(row.location.trim());
    }
    if (!entry.domain) {
      entry.domain = extractCompanyDomain(row.application_url) || extractCompanyDomain(row.source_url);
    }
  }

  return Array.from(map.values())
    .map((e) => ({
      name: e.name,
      slug: e.slug,
      jobCount: e.jobCount,
      locations: Array.from(e.locations).slice(0, 3),
      domain: e.domain,
    }))
    .sort((a, b) => b.jobCount - a.jobCount);
}

export async function getCompanyBySlug(slug: string): Promise<CompanyDetail | null> {
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug) return null;

  const supabase = await createClient();
  const searchTerm = slugToSearchTerm(cleanSlug);

  // Fetch jobs for this company
  const { data: rows, error } = await supabase
    .from("jobs")
    .select("id, title, company_name, location, country, employment_type, seniority, salary_min, salary_max, salary_currency, application_url, source_url, source, published_at, skills")
    .ilike("company_name", `%${searchTerm}%`)
    .order("published_at", { ascending: false });

  if (error || !rows || rows.length === 0) {
    // If ilike didn't catch, fallback to matching by exact slug across all jobs
    const { data: allRows } = await supabase
      .from("jobs")
      .select("id, title, company_name, location, country, employment_type, seniority, salary_min, salary_max, salary_currency, application_url, source_url, source, published_at, skills")
      .not("company_name", "is", null);

    if (!allRows) return null;
    const matched = allRows.filter((r) => companyToSlug(r.company_name) === cleanSlug);
    if (matched.length === 0) return null;
    return buildCompanyDetail(cleanSlug, matched);
  }

  // Filter exact slug match to prevent over-matching (e.g. "Google" matching "Google Cloud")
  const matched = rows.filter((r) => companyToSlug(r.company_name) === cleanSlug);
  const targetRows = matched.length > 0 ? matched : rows;

  return buildCompanyDetail(cleanSlug, targetRows);
}

function buildCompanyDetail(
  slug: string,
  rows: Array<{
    id: string;
    title: string;
    company_name: string | null;
    location: string | null;
    country: string | null;
    employment_type: string | null;
    seniority: string | null;
    salary_min: number | null;
    salary_max: number | null;
    salary_currency: string | null;
    application_url: string | null;
    source_url: string | null;
    source: string | null;
    published_at: string | null;
    skills: string[] | null;
  }>,
): CompanyDetail {
  const canonicalName = rows[0]?.company_name || slug;
  const locations = Array.from(new Set(rows.map((r) => r.location?.trim()).filter(Boolean) as string[]));
  const countries = Array.from(new Set(rows.map((r) => r.country?.trim()).filter(Boolean) as string[]));
  const employmentTypes = Array.from(new Set(rows.map((r) => r.employment_type?.trim()).filter(Boolean) as string[]));

  const allSkills = new Set<string>();
  let domain: string | null = null;

  for (const r of rows) {
    if (Array.isArray(r.skills)) {
      r.skills.forEach((s) => allSkills.add(s));
    }
    if (!domain) {
      domain = extractCompanyDomain(r.application_url) || extractCompanyDomain(r.source_url);
    }
  }

  return {
    name: canonicalName,
    slug,
    jobCount: rows.length,
    locations,
    countries,
    employmentTypes,
    skills: Array.from(allSkills).slice(0, 15),
    domain,
    jobs: rows.map((r) => ({
      id: r.id,
      title: r.title,
      location: r.location,
      employment_type: r.employment_type,
      seniority: r.seniority,
      salary_min: r.salary_min,
      salary_max: r.salary_max,
      salary_currency: r.salary_currency,
      application_url: r.application_url,
      source: r.source,
      published_at: r.published_at,
      skills: r.skills,
    })),
  };
}
