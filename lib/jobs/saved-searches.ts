import type { EquityFilter } from "./equity";
import type {
  DatePostedFilter,
  ExperienceFilter,
  IndustryCategory,
  WorkplaceFilter,
} from "./filters";

export interface SavedSearchCriteria {
  search?: string;
  equity?: EquityFilter;
  workplace?: WorkplaceFilter;
  experience?: ExperienceFilter;
  industry?: IndustryCategory;
  datePosted?: DatePostedFilter;
  salaryMinFloor?: number;
  location?: string;
  employmentType?: string;
  minimumScore?: number;
  sourceFilter?: "all" | "himalayas" | "remotive" | "arbeitnow" | "jobpilot" | "user";
  sort?: "match" | "recent" | "salary";
}

export interface SavedSearchRecord {
  id: string;
  user_id: string;
  name: string;
  criteria: SavedSearchCriteria;
  created_at: string;
  updated_at: string;
}

export function validateSavedSearchName(name: unknown): { valid: boolean; sanitized: string; error?: string } {
  if (typeof name !== "string") {
    return { valid: false, sanitized: "", error: "Search name must be a text string." };
  }
  const sanitized = name.trim().slice(0, 100);
  if (!sanitized) {
    return { valid: false, sanitized: "", error: "Please enter a name for this saved search." };
  }
  return { valid: true, sanitized };
}

export function validateSavedSearchCriteria(input: unknown): { valid: boolean; criteria: SavedSearchCriteria; error?: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { valid: false, criteria: {}, error: "Criteria must be a valid JSON object." };
  }

  const raw = input as Record<string, unknown>;
  const criteria: SavedSearchCriteria = {};

  if (typeof raw.search === "string") {
    criteria.search = raw.search.trim().slice(0, 200);
  }

  if (typeof raw.equity === "string" && ["all", "mentioned", "range"].includes(raw.equity)) {
    criteria.equity = raw.equity as EquityFilter;
  }

  const validWorkplace: WorkplaceFilter[] = ["all", "remote", "hybrid", "onsite"];
  if (typeof raw.workplace === "string" && validWorkplace.includes(raw.workplace as WorkplaceFilter)) {
    criteria.workplace = raw.workplace as WorkplaceFilter;
  }

  const validExp: ExperienceFilter[] = ["all", "entry", "mid", "senior", "lead"];
  if (typeof raw.experience === "string" && validExp.includes(raw.experience as ExperienceFilter)) {
    criteria.experience = raw.experience as ExperienceFilter;
  }

  const validIndustry: IndustryCategory[] = ["all", "engineering", "product", "design", "data", "sales-marketing", "operations"];
  if (typeof raw.industry === "string" && validIndustry.includes(raw.industry as IndustryCategory)) {
    criteria.industry = raw.industry as IndustryCategory;
  }

  const validDate: DatePostedFilter[] = ["all", "24h", "7d", "30d"];
  if (typeof raw.datePosted === "string" && validDate.includes(raw.datePosted as DatePostedFilter)) {
    criteria.datePosted = raw.datePosted as DatePostedFilter;
  }

  if (typeof raw.salaryMinFloor === "number" && Number.isFinite(raw.salaryMinFloor) && raw.salaryMinFloor >= 0) {
    criteria.salaryMinFloor = raw.salaryMinFloor;
  }

  if (typeof raw.location === "string") {
    criteria.location = raw.location.trim().slice(0, 100);
  }

  if (typeof raw.employmentType === "string") {
    criteria.employmentType = raw.employmentType.trim().slice(0, 50);
  }

  if (typeof raw.minimumScore === "number" && Number.isFinite(raw.minimumScore) && raw.minimumScore >= 0 && raw.minimumScore <= 100) {
    criteria.minimumScore = raw.minimumScore;
  }

  const validSource = ["all", "himalayas", "remotive", "arbeitnow", "jobpilot", "user"];
  if (typeof raw.sourceFilter === "string" && validSource.includes(raw.sourceFilter)) {
    criteria.sourceFilter = raw.sourceFilter as SavedSearchCriteria["sourceFilter"];
  }

  const validSort = ["match", "recent", "salary"];
  if (typeof raw.sort === "string" && validSort.includes(raw.sort)) {
    criteria.sort = raw.sort as SavedSearchCriteria["sort"];
  }

  return { valid: true, criteria };
}

export function formatCriteriaSummary(criteria: SavedSearchCriteria): string[] {
  const parts: string[] = [];

  if (criteria.equity && criteria.equity !== "all") parts.push(criteria.equity === "range" ? "Equity % disclosed" : "Equity mentioned");
  if (criteria.search) parts.push(`"${criteria.search}"`);
  if (criteria.workplace && criteria.workplace !== "all") {
    parts.push(criteria.workplace === "remote" ? "Remote" : criteria.workplace === "hybrid" ? "Hybrid" : "On-site");
  }
  if (criteria.experience && criteria.experience !== "all") {
    parts.push(criteria.experience === "entry" ? "Entry" : criteria.experience === "mid" ? "Mid" : criteria.experience === "senior" ? "Senior" : "Lead");
  }
  if (criteria.industry && criteria.industry !== "all") {
    parts.push(criteria.industry);
  }
  if (criteria.salaryMinFloor && criteria.salaryMinFloor > 0) {
    parts.push(`$${Math.round(criteria.salaryMinFloor / 1000)}k+ / ₹${Math.round(criteria.salaryMinFloor / 100000)}L`);
  }
  if (criteria.location && criteria.location !== "all") {
    parts.push(criteria.location);
  }
  if (criteria.datePosted && criteria.datePosted !== "all") {
    parts.push(criteria.datePosted);
  }

  return parts.length > 0 ? parts : ["All open roles"];
}
