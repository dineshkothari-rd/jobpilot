import { isCityOrAliasMatch } from "../matching/scorer.ts";

export type RoleCategory =
  | "frontend"
  | "backend"
  | "fullstack"
  | "mobile"
  | "devops"
  | "data-ai"
  | "product-design"
  | "qa-testing"
  | "general-software";

export type ExperienceLevel = "entry" | "mid" | "senior" | "lead" | "unknown";

export type SalaryBenchmark = {
  role: RoleCategory;
  roleLabel: string;
  currency: string; // "INR" or "USD"
  sampleCount: number;
  p25: number;
  median: number;
  p75: number;
  min: number;
  max: number;
  experienceBreakdown: Record<ExperienceLevel, {
    sampleCount: number;
    median: number | null;
    p25: number | null;
    p75: number | null;
  }>;
  sources: string[];
  insufficientData: boolean;
};

export const ROLE_LABELS: Record<RoleCategory, string> = {
  frontend: "Frontend Engineering",
  backend: "Backend Engineering",
  fullstack: "Fullstack Engineering",
  mobile: "Mobile Development (iOS / Android / Flutter)",
  devops: "DevOps & Cloud Infrastructure",
  "data-ai": "Data Science & AI / ML",
  "product-design": "Product Management & UI/UX Design",
  "qa-testing": "QA & Automation Testing",
  "general-software": "Software Engineering (General)",
};

export function classifyJobRole(title: string | null | undefined): RoleCategory {
  const t = (title || "").toLowerCase();
  if (/\b(fullstack|full-stack|full stack)\b/.test(t)) return "fullstack";
  if (/\b(mobile|ios|android|flutter|react native|swift|kotlin)\b/.test(t)) return "mobile";
  if (/\b(frontend|front-end|react|vue|angular|ui developer|web developer)\b/.test(t)) return "frontend";
  if (/\b(backend|back-end|node|python|golang|go developer|java developer|django|ruby|rails)\b/.test(t)) return "backend";
  if (/\b(devops|sre|site reliability|cloud|kubernetes|aws|infrastructure|platform engineer)\b/.test(t)) return "devops";
  if (/\b(data scientist|data engineer|machine learning|ml engineer|ai engineer|deep learning|nlp)\b/.test(t)) return "data-ai";
  if (/\b(product manager|product owner|ui\/ux|ux designer|product designer)\b/.test(t)) return "product-design";
  if (/\b(qa|quality assurance|sdet|test engineer|automation engineer)\b/.test(t)) return "qa-testing";
  return "general-software";
}

export function classifyExperienceLevel(seniority: string | null | undefined, title: string | null | undefined): ExperienceLevel {
  const combined = `${seniority || ""} ${title || ""}`.toLowerCase();
  if (/\b(lead|staff|principal|director|head|vp|architect)\b/.test(combined)) return "lead";
  if (/\b(senior|sr\b|sr\.|experienced)\b/.test(combined)) return "senior";
  if (/\b(junior|jr\b|entry|graduate|fresher|intern|associate)\b/.test(combined)) return "entry";
  if (/\b(mid|intermediate)\b/.test(combined)) return "mid";
  return "unknown";
}

export function computePercentile(sortedValues: number[], percentile: number): number {
  if (sortedValues.length === 0) return 0;
  if (sortedValues.length === 1) return sortedValues[0];

  const index = (percentile / 100) * (sortedValues.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sortedValues[lower];
  return Math.round(sortedValues[lower] * (1 - weight) + sortedValues[upper] * weight);
}

export type RawSalaryJob = {
  id: string;
  title: string;
  company_name: string | null;
  location: string | null;
  seniority: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string | null;
  source: string | null;
  published_at: string | null;
  application_url?: string | null;
  source_url?: string | null;
};

export function filterSalaryJobs(jobs: RawSalaryJob[], role: RoleCategory, currency: string, location = "all"): RawSalaryJob[] {
  return jobs.filter((job) => {
    const curr = (job.salary_currency || "").trim().toUpperCase();
    if (!(currency === "INR" ? ["INR", "₹"] : currency === "USD" ? ["USD", "$"] : []).includes(curr)) return false;
    if (classifyJobRole(job.title) !== role) return false;
    const bounds = [job.salary_min, job.salary_max].filter((value) => value != null);
    if (!bounds.length || bounds.some((value) => !Number.isFinite(value) || value <= 0)) return false;
    if (job.salary_min != null && job.salary_max != null && job.salary_min > job.salary_max) return false;
    if (location !== "all") {
      const loc = (job.location || "").toLowerCase();
      if (location === "remote") return /remote|worldwide|work from home|distributed/.test(loc);
      return isCityOrAliasMatch(loc, location.toLowerCase());
    }
    return true;
  });
}

export function calculateSalaryBenchmark(
  jobs: RawSalaryJob[],
  roleFilter?: RoleCategory,
  targetCurrency = "INR",
  minSamples = 2,
): SalaryBenchmark {
  const selectedRole: RoleCategory = roleFilter || "fullstack";

  const relevantJobs = filterSalaryJobs(jobs, selectedRole, targetCurrency);

  const sources = Array.from(new Set(relevantJobs.map((j) => j.source).filter((s): s is string => Boolean(s))));

  const salaryValues: number[] = [];
  const expBuckets: Record<ExperienceLevel, number[]> = {
    entry: [],
    mid: [],
    senior: [],
    lead: [],
    unknown: [],
  };

  for (const job of relevantJobs) {
    let val: number | null = null;
    if (job.salary_min != null && job.salary_max != null) {
      val = Math.round((job.salary_min + job.salary_max) / 2);
    } else if (job.salary_min != null) {
      val = job.salary_min;
    } else if (job.salary_max != null) {
      val = job.salary_max;
    }

    if (val != null && val > 0) {
      salaryValues.push(val);
      const exp = classifyExperienceLevel(job.seniority, job.title);
      expBuckets[exp].push(val);
    }
  }

  salaryValues.sort((a, b) => a - b);
  Object.values(expBuckets).forEach((b) => b.sort((a, b) => a - b));

  const sampleCount = salaryValues.length;
  const insufficientData = sampleCount < minSamples;

  const experienceBreakdown: SalaryBenchmark["experienceBreakdown"] = {
    entry: {
      sampleCount: expBuckets.entry.length,
      median: expBuckets.entry.length >= minSamples ? computePercentile(expBuckets.entry, 50) : null,
      p25: expBuckets.entry.length >= minSamples ? computePercentile(expBuckets.entry, 25) : null,
      p75: expBuckets.entry.length >= minSamples ? computePercentile(expBuckets.entry, 75) : null,
    },
    mid: {
      sampleCount: expBuckets.mid.length,
      median: expBuckets.mid.length >= minSamples ? computePercentile(expBuckets.mid, 50) : null,
      p25: expBuckets.mid.length >= minSamples ? computePercentile(expBuckets.mid, 25) : null,
      p75: expBuckets.mid.length >= minSamples ? computePercentile(expBuckets.mid, 75) : null,
    },
    senior: {
      sampleCount: expBuckets.senior.length,
      median: expBuckets.senior.length >= minSamples ? computePercentile(expBuckets.senior, 50) : null,
      p25: expBuckets.senior.length >= minSamples ? computePercentile(expBuckets.senior, 25) : null,
      p75: expBuckets.senior.length >= minSamples ? computePercentile(expBuckets.senior, 75) : null,
    },
    unknown: {
      sampleCount: expBuckets.unknown.length,
      median: expBuckets.unknown.length >= minSamples ? computePercentile(expBuckets.unknown, 50) : null,
      p25: expBuckets.unknown.length >= minSamples ? computePercentile(expBuckets.unknown, 25) : null,
      p75: expBuckets.unknown.length >= minSamples ? computePercentile(expBuckets.unknown, 75) : null,
    },
    lead: {
      sampleCount: expBuckets.lead.length,
      median: expBuckets.lead.length >= minSamples ? computePercentile(expBuckets.lead, 50) : null,
      p25: expBuckets.lead.length >= minSamples ? computePercentile(expBuckets.lead, 25) : null,
      p75: expBuckets.lead.length >= minSamples ? computePercentile(expBuckets.lead, 75) : null,
    },
  };

  return {
    role: selectedRole,
    roleLabel: ROLE_LABELS[selectedRole],
    currency: targetCurrency,
    sampleCount,
    p25: sampleCount > 0 ? computePercentile(salaryValues, 25) : 0,
    median: sampleCount > 0 ? computePercentile(salaryValues, 50) : 0,
    p75: sampleCount > 0 ? computePercentile(salaryValues, 75) : 0,
    min: sampleCount > 0 ? salaryValues[0] : 0,
    max: sampleCount > 0 ? salaryValues[salaryValues.length - 1] : 0,
    experienceBreakdown,
    sources,
    insufficientData,
  };
}

export function formatCompensationValue(val: number | null | undefined, currency: string): string {
  if (val == null || val <= 0) return "N/A";
  if (currency === "INR") {
    if (val >= 100_000) {
      const lpa = val / 100_000;
      return `${lpa >= 10 ? lpa.toFixed(0) : lpa.toFixed(1)} LPA`;
    }
    return `₹${val.toLocaleString("en-IN")}`;
  }
  if (val >= 1_000) {
    return `$${Math.round(val / 1_000)}k`;
  }
  return `$${val.toLocaleString("en-US")}`;
}
