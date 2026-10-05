export type OpportunityCategory = "all" | "internship" | "fresher";
export type InternshipDuration = "all" | "1-3m" | "3-6m" | "6m+";
export type InternshipAvailability = "all" | "immediate" | "summer" | "flexible";

export interface InternshipClassifierInput {
  title?: string | null;
  employment_type?: string | null;
  seniority?: string | null;
  description?: string | null;
  skills?: string[] | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string | null;
}

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

/**
 * Checks whether a job qualifies as an internship or fresher/entry-level opportunity.
 */
export function isInternshipOrFresher(job: InternshipClassifierInput): boolean {
  const empType = normalize(job.employment_type);
  if (empType === "internship" || empType === "intern" || empType === "trainee") {
    return true;
  }

  const text = normalize([job.title, job.seniority, job.description].filter(Boolean).join(" "));

  // Explicit exclude for senior / lead roles that happen to mention "mentor an intern"
  const title = normalize(job.title);
  if (/senior|sr\b|lead|principal|staff|director|head of|vp\b|manager/i.test(title)) {
    return false;
  }

  const isIntern = /\b(?:intern|internship|trainee|apprentice|co-op|fellowship)\b/i.test(title) ||
    /\b(?:intern|internship|trainee)\b/i.test(job.seniority || "");

  const isFresher = /\b(?:fresher|fresh graduate|entry level|graduate trainee|associate engineer|junior developer|jr\b|0-1\s*(?:year|yr)|0-2\s*(?:years?|yrs?))\b/i.test(title) ||
    /\b(?:entry|junior|fresher|graduate)\b/i.test(job.seniority || "");

  if (isIntern || isFresher) return true;

  // Check description hints if title is generic (e.g., "Software Engineer")
  if (/\b(?:open to freshers|looking for interns|internship duration|college students?|no prior experience required|recent graduates?)\b/i.test(text)) {
    return true;
  }

  return false;
}

/**
 * Differentiates between a formal internship and an entry-level / fresher position.
 */
export function classifyOpportunityType(job: InternshipClassifierInput): "internship" | "fresher" {
  const empType = normalize(job.employment_type);
  const title = normalize(job.title);
  const seniority = normalize(job.seniority);

  if (/\b(?:graduate trainee|management trainee|engineer trainee|trainee engineer)\b/i.test(title)) {
    return "fresher";
  }

  if (empType === "internship" || empType === "intern" || /\bintern|internship|apprentice|co-op\b/i.test(title) || /\bintern\b/i.test(seniority)) {
    return "internship";
  }

  return "fresher";
}

/**
 * Extracts estimated internship duration if specified in text.
 */
export function detectInternshipDuration(job: InternshipClassifierInput): "1-3m" | "3-6m" | "6m+" | "flexible" {
  const text = normalize([job.title, job.description].filter(Boolean).join(" "));

  if (/\b(?:1|2|3)\s*(?:months?|mos?)\b/i.test(text) || /\b(?:8|10|12)\s*weeks?\b/i.test(text)) {
    return "1-3m";
  }
  if (/\b(?:4|5|6)\s*(?:months?|mos?)\b/i.test(text) || /\b(?:16|20|24)\s*weeks?\b/i.test(text) || /\bsemester\b/i.test(text)) {
    return "3-6m";
  }
  if (/\b(?:6\+|9|12)\s*(?:months?|mos?)\b/i.test(text) || /\b1\s*year\s*internship\b/i.test(text)) {
    return "6m+";
  }

  return "flexible";
}

/**
 * Calculates or estimates monthly stipend/compensation from job data.
 */
export function parseMonthlyStipend(job: InternshipClassifierInput): {
  monthlyMin: number | null;
  monthlyMax: number | null;
  currency: string;
  isStipend: boolean;
} {
  const currency = (job.salary_currency || "USD").toUpperCase();
  const min = job.salary_min;
  const max = job.salary_max;

  if (min == null && max == null) {
    return { monthlyMin: null, monthlyMax: null, currency, isStipend: false };
  }

  const isINR = currency === "INR" || currency === "₹";
  const rawMax = max ?? min ?? 0;

  // If already in monthly range (e.g., INR 10,000 - 50,000 or USD 500 - 5,000)
  if (isINR && rawMax <= 80_000) {
    return {
      monthlyMin: min ?? null,
      monthlyMax: max ?? null,
      currency: "INR",
      isStipend: true,
    };
  }
  if (!isINR && rawMax <= 8_000) {
    return {
      monthlyMin: min ?? null,
      monthlyMax: max ?? null,
      currency,
      isStipend: true,
    };
  }

  // If annual CTC/compensation (e.g. INR 4-8 LPA or USD 60k), divide by 12
  return {
    monthlyMin: min != null ? Math.round(min / 12) : null,
    monthlyMax: max != null ? Math.round(max / 12) : null,
    currency: isINR ? "INR" : currency,
    isStipend: false,
  };
}

/**
 * Filters opportunity by category, duration, and minimum stipend.
 */
export function matchesInternshipFilters(
  job: InternshipClassifierInput,
  options: {
    category?: OpportunityCategory;
    duration?: InternshipDuration;
    minStipendFloor?: number;
  },
): boolean {
  if (!isInternshipOrFresher(job)) return false;

  const { category = "all", duration = "all", minStipendFloor = 0 } = options;

  if (category !== "all") {
    const oppType = classifyOpportunityType(job);
    if (oppType !== category) return false;
  }

  if (duration !== "all") {
    const detectedDuration = detectInternshipDuration(job);
    if (detectedDuration !== "flexible" && detectedDuration !== duration) {
      return false;
    }
  }

  if (minStipendFloor > 0) {
    const stipend = parseMonthlyStipend(job);
    const maxVal = stipend.monthlyMax ?? stipend.monthlyMin;
    if (maxVal == null) return false;

    if (stipend.currency === "INR") {
      // If minStipendFloor is e.g. 10000, maxVal in INR must be >= 10000
      const inrFloor = minStipendFloor < 1000 ? minStipendFloor * 50 : minStipendFloor;
      if (maxVal < inrFloor) return false;
    } else {
      if (maxVal < minStipendFloor) return false;
    }
  }

  return true;
}
