export type WorkplaceType = "remote" | "hybrid" | "onsite";
export type WorkplaceFilter = "all" | "remote" | "hybrid" | "onsite";
export type ExperienceFilter = "all" | "entry" | "mid" | "senior" | "lead";
export type DatePostedFilter = "all" | "24h" | "7d" | "30d";
export type IndustryCategory = "all" | "engineering" | "product" | "design" | "data" | "sales-marketing" | "operations";

function normalize(value: string | null | undefined): string {
  return (value || "").trim().toLowerCase();
}

export function detectWorkplaceType(job: {
  location?: string | null;
  description?: string | null;
  skills?: string[] | null;
}): WorkplaceType {
  const text = normalize([job.location, job.description, ...(job.skills || [])].filter(Boolean).join(" "));
  if (/\bhybrid\b/.test(text)) return "hybrid";
  if (/remote|worldwide|work from home|distributed/.test(text)) return "remote";
  return "onsite";
}

export function matchesWorkplace(
  job: { location?: string | null; description?: string | null; skills?: string[] | null },
  filter: WorkplaceFilter,
): boolean {
  if (filter === "all") return true;
  const detected = detectWorkplaceType(job);
  return detected === filter;
}

export function matchesExperience(
  job: { seniority?: string | null; title?: string | null; description?: string | null },
  filter: ExperienceFilter,
): boolean {
  if (filter === "all") return true;
  const text = normalize([job.seniority, job.title, job.description].filter(Boolean).join(" "));

  if (filter === "entry") {
    return /entry|junior|jr\b|fresher|graduate|intern|associate\b|0-2\s*(?:years?|yrs?)/.test(text);
  }
  if (filter === "mid") {
    return (
      (/mid|intermediate|experienced|2-5\s*(?:years?|yrs?)|3-5\s*(?:years?|yrs?)/.test(text) ||
        !/senior|sr\b|lead|staff|principal|director|head of/.test(text)) &&
      !/intern|fresher|graduate|student/.test(text)
    );
  }
  if (filter === "senior") {
    return (
      /senior|sr\b|5\+\s*(?:years?|yrs?)|4-8\s*(?:years?|yrs?)|5-8\s*(?:years?|yrs?)/.test(text) &&
      !/director|vp\b|head of|chief/.test(text)
    );
  }
  if (filter === "lead") {
    return /lead|staff|principal|director|head of|vp\b|manager|architect|8\+\s*(?:years?|yrs?)/.test(text);
  }
  return true;
}

export function matchesDatePosted(
  publishedAt: string | null | undefined,
  filter: DatePostedFilter,
  referenceNow: number = Date.now(),
): boolean {
  if (filter === "all" || !publishedAt) return true;
  const timestamp = new Date(publishedAt).getTime();
  if (!Number.isFinite(timestamp)) return true;
  const ageMs = Math.max(0, referenceNow - timestamp);

  if (filter === "24h") return ageMs <= 24 * 60 * 60 * 1000;
  if (filter === "7d") return ageMs <= 7 * 24 * 60 * 60 * 1000;
  if (filter === "30d") return ageMs <= 30 * 24 * 60 * 60 * 1000;
  return true;
}

export function matchesIndustry(
  job: { title?: string | null; skills?: string[] | null; description?: string | null },
  category: IndustryCategory,
): boolean {
  if (category === "all") return true;
  const text = normalize([job.title, ...(job.skills || []), job.description].filter(Boolean).join(" "));

  switch (category) {
    case "engineering":
      return /engineer|developer|frontend|backend|fullstack|software|devops|cloud|security|infrastructure|qa\b|tester|systems/.test(text);
    case "product":
      return /product manager|product owner|technical program manager|project manager|scrum master|head of product|agile/.test(text);
    case "design":
      return /designer|ui\/ux|ux designer|product designer|graphic designer|brand|visual designer|interaction designer/.test(text);
    case "data":
      return /data analyst|data scientist|machine learning|ai engineer|analytics|data engineer|bi analyst|deep learning|llm/.test(text);
    case "sales-marketing":
      return /marketing|sales|growth|seo|content|account executive|business development|copywriter|social media|customer success/.test(text);
    case "operations":
      return /operations|finance|accounting|hr\b|recruiter|talent|legal|compliance|office manager|people partner/.test(text);
    default:
      return true;
  }
}

export function matchesSalaryFloor(
  job: { salary_min?: number | null; salary_max?: number | null; salary_currency?: string | null },
  minFloor: number,
): boolean {
  if (minFloor <= 0) return true;
  const max = job.salary_max ?? job.salary_min;
  if (max == null) return false;
  const currency = (job.salary_currency || "").toUpperCase();
  if (currency === "INR" || currency === "₹") {
    // Standard tiers: 50k USD corresponds to 5 LPA (500,000 INR), 100k to 10 LPA (1,000,000 INR), etc.
    const inrFloor = minFloor <= 300_000 ? minFloor * 10 : minFloor;
    return max >= inrFloor;
  }
  return max >= minFloor;
}
