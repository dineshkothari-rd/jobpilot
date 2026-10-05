import { jobId } from "./manual.ts";

export const REPORT_CATEGORIES = {
  payment: "Requests payment or an upfront fee",
  impersonation: "Fake company or recruiter",
  phishing: "Suspicious link or personal-data request",
  misleading: "Misleading job or compensation details",
  other: "Other safety concern",
};

export function parseJobReport(input: unknown) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Check the report details.");
  const value = input as Record<string, unknown>;
  if (Object.keys(value).some(key => !["job_id", "category", "details"].includes(key)) || !jobId(value.job_id)
    || typeof value.category !== "string" || !Object.hasOwn(REPORT_CATEGORIES, value.category)
    || typeof value.details !== "string" || value.details.trim().length < 10 || value.details.length > 2000) {
    throw new Error("Choose a category and describe the concern in 10–2000 characters.");
  }
  return { job_id: value.job_id, category: value.category, details: value.details.trim() };
}

export function isModerator(user: { app_metadata?: Record<string, unknown> } | null) {
  return user?.app_metadata?.role === "admin";
}
