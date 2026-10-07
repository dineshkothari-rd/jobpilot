import { interviewInstant } from "../applications/interviews.ts";
import { boolean, hiringInput, hiringNote } from "./applications.ts";
import { uuid } from "./validation.ts";
export function initialVersion(value: unknown) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
    throw Error("Reload before saving.");
  return value;
}
export function hiringPage(params: URLSearchParams) {
  const value = params.get("offset") || "0";
  if (!/^\d{1,6}$/.test(value) || Number(value) > 100000)
    throw Error("Invalid page.");
  return Number(value);
}
export function searchInput(params: URLSearchParams) {
  const text = (key: string) => {
    const value = params.get(key)?.trim() || null;
    if (value && value.length > 100)
      throw Error("Search terms must be at most 100 characters.");
    return value;
  };
  const experience = params.get("experience");
  if (
    experience !== null &&
    (!/^\d{1,2}$/.test(experience) || Number(experience) > 80)
  )
    throw Error("Invalid experience filter.");
  const shortlists = params.get("shortlists");
  if (shortlists !== null && !["true", "false"].includes(shortlists))
    throw Error("Invalid shortlist filter.");
  return {
    p_role: text("role"),
    p_location: text("location"),
    p_skill: text("skill"),
    p_experience: experience === null ? null : Number(experience),
    p_offset: hiringPage(params),
    p_shortlists: shortlists === "true",
  };
}
export function shortlistInput(value: unknown) {
  const body = hiringInput(value);
  if (
    !["shortlist", "in_review", "contacted", "passed"].includes(
      String(body.status),
    )
  )
    throw Error("Choose a sourcing stage.");
  return {
    p_candidate: uuid(body.candidate_id),
    p_version: initialVersion(body.version),
    p_status: String(body.status),
    p_notes: hiringNote(body.notes),
  };
}
export function invitationInput(value: unknown) {
  const b = hiringInput(value);
  if (typeof b.timezone !== "string" || typeof b.local_time !== "string")
    throw Error("Confirm the interview time and timezone.");
  const starts_at = interviewInstant(b.local_time, b.timezone);
  if (
    Date.parse(starts_at) <= Date.now() ||
    Date.parse(starts_at) > Date.now() + 366 * 86400000
  )
    throw Error("Choose a future interview within one year.");
  if (
    !Number.isInteger(b.duration_minutes) ||
    Number(b.duration_minutes) < 5 ||
    Number(b.duration_minutes) > 480
  )
    throw Error("Duration must be 5–480 minutes.");
  const round = hiringNote(b.round, 120);
  if (!round) throw Error("Enter an interview round.");
  return {
    p_id: uuid(b.id),
    p_thread: uuid(b.thread_id),
    p_job: uuid(b.job_id),
    p_version: initialVersion(b.version),
    p_fields: {
      round,
      starts_at,
      timezone: b.timezone,
      duration_minutes: Number(b.duration_minutes),
      location: hiringNote(b.location, 1000),
      notes: hiringNote(b.notes, 2000),
    },
  };
}
export function brandingInput(value: unknown) {
  const b = hiringInput(value);
  const items = (key: string, max: number) => {
    if (!Array.isArray(b[key]) || (b[key] as unknown[]).length > max)
      throw Error(`Too many ${key}.`);
    return [
      ...new Set(
        (b[key] as unknown[]).map((value) => {
          const text = hiringNote(value, 100);
          if (!text) throw Error(`Check ${key}.`);
          return text;
        }),
      ),
    ];
  };
  if (
    !["blue", "green", "violet", "slate"].includes(String(b.banner_style)) ||
    !Array.isArray(b.leadership) ||
    b.leadership.length > 10
  )
    throw Error("Check banner and leadership details.");
  const leadership = b.leadership.map((value) => {
    const row = hiringInput(value),
      name = hiringNote(row.name, 100),
      role = hiringNote(row.role, 100);
    if (!name || !role) throw Error("Enter each leader’s name and role.");
    return { name, role };
  });
  return {
    p_version: initialVersion(b.version),
    p_fields: {
      tagline: hiringNote(b.tagline, 240),
      about: hiringNote(b.about),
      culture: hiringNote(b.culture, 2000),
      perks: items("perks", 20),
      tech_stack: items("tech_stack", 30),
      leadership,
      banner_style: String(b.banner_style),
      published: boolean(b.published),
    },
  };
}
