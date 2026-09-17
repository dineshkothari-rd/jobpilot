import type { LearningPath } from "./catalog.ts";

export type Enrollment = {
  path_id: string;
  version: number;
  completed: string[];
  bookmarks: string[];
  notes: Record<string, string>;
  selected_lesson: string;
  minutes_per_day: number;
  target_role: string;
  project_url: string;
  project_summary: string;
  updated_at: string;
};
export type Credential = {
  id: string;
  kind: "external" | "jobpilot";
  path_id: string | null;
  title: string;
  issuer: string;
  issued_on: string;
  expires_on: string | null;
  verification_url: string;
  credential_ref: string;
  public_name: string;
  is_public: boolean;
  revoked_at: string | null;
};
export type Attempt = { id: string; path_id: string; score: number; created_at: string };

export function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an object.");
  return value as Record<string, unknown>;
}
export function boundedText(value: unknown, max: number, label: string, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) throw new Error(`${label} is required and must be at most ${max} characters.`);
  return value.trim();
}
export function publicHttpsUrl(value: unknown, required = false) {
  const text = boundedText(value, 2000, "URL", required);
  if (!text) return "";
  let url: URL;
  try { url = new URL(text); } catch { throw new Error("Use a public HTTPS URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.port || !url.hostname.includes(".") || /^[\d.]+$/.test(url.hostname) || url.hostname.includes(":") || /\.(local|internal|localhost|test|invalid)$/.test(url.hostname)) throw new Error("Use a public HTTPS URL without credentials or a custom port.");
  return url.href;
}

export function initialEnrollment(path: LearningPath, minutes = 30, role = ""): Enrollment {
  return { path_id: path.id, version: 1, completed: [], bookmarks: [], notes: {}, selected_lesson: path.lessons[0].id,
    minutes_per_day: minutes, target_role: role, project_url: "", project_summary: "", updated_at: new Date().toISOString() };
}

export function parseProgress(value: unknown, path: LearningPath) {
  const row = record(value);
  const fields = ["completed", "bookmarks", "notes", "selected_lesson", "minutes_per_day", "target_role", "project_url", "project_summary"];
  if (Object.keys(row).some((key) => !fields.includes(key))) throw new Error("Unsupported progress field.");
  const ids = new Set(path.lessons.map((lesson) => lesson.id));
  const list = (value: unknown) => {
    if (!Array.isArray(value) || value.length > ids.size || value.some((id) => typeof id !== "string" || !ids.has(id)) || new Set(value).size !== value.length) throw new Error("Choose lessons from this path only.");
    return value as string[];
  };
  const notes = record(row.notes);
  if (Object.keys(notes).some((id) => !ids.has(id))) throw new Error("Unknown lesson note.");
  const cleanNotes = Object.fromEntries(Object.entries(notes).map(([id, note]) => [id, boundedText(note, 2000, "Lesson note")]));
  if (typeof row.selected_lesson !== "string" || !ids.has(row.selected_lesson)) throw new Error("Choose a lesson in this path.");
  if (!Number.isInteger(row.minutes_per_day) || Number(row.minutes_per_day) < 10 || Number(row.minutes_per_day) > 180) throw new Error("Choose 10–180 minutes per day.");
  return {
    completed: list(row.completed), bookmarks: list(row.bookmarks), notes: cleanNotes,
    selected_lesson: row.selected_lesson, minutes_per_day: Number(row.minutes_per_day),
    target_role: boundedText(row.target_role, 120, "Target role"), project_url: publicHttpsUrl(row.project_url),
    project_summary: boundedText(row.project_summary, 2000, "Project explanation"),
  };
}

export function certificateEligible(path: LearningPath, enrollment: Enrollment, score: number) {
  return path.lessons.every((lesson) => enrollment.completed.includes(lesson.id)) && score >= 67 &&
    Boolean(enrollment.project_url) && enrollment.project_summary.trim().length >= 50;
}

export function dateOnly(value: unknown, label: string, optional = false) {
  if (optional && (value === "" || value === null)) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Choose a valid ${label}.`);
  const date = new Date(value + "T00:00:00Z");
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new Error(`Choose a valid ${label}.`);
  return value;
}

export function parseExternalCredential(value: unknown) {
  const row = record(value);
  if (Object.keys(row).some((key) => !["title", "issuer", "issued_on", "expires_on", "verification_url", "credential_ref", "confirmed"].includes(key)) || row.confirmed !== true) throw new Error("Confirm this credential was actually issued to you.");
  const issued_on = dateOnly(row.issued_on, "issue date")!;
  const expires_on = dateOnly(row.expires_on, "expiry date", true);
  if (issued_on > new Date().toISOString().slice(0, 10) || (expires_on && expires_on < issued_on)) throw new Error("Check the issue and expiry dates.");
  const issuer = boundedText(row.issuer, 120, "Issuer", true);
  if (issuer.toLowerCase() === "jobpilot") throw new Error("JobPilot records are issued by completing a path, not through provider import.");
  return { title: boundedText(row.title, 180, "Credential title", true), issuer, issued_on, expires_on,
    verification_url: publicHttpsUrl(row.verification_url), credential_ref: boundedText(row.credential_ref, 180, "Credential ID") };
}

export const credentialIdValid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function resumeEvidence(enrollment: Enrollment, path: LearningPath) {
  return `Learning project: ${path.title}\n${enrollment.project_summary}\nProject: ${enrollment.project_url}\nLearning topics: ${path.skills.join(", ")}\nSelf-reported project; not employment experience or a provider credential.`;
}
