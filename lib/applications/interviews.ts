export type Interview = {
  id: string; application_id: string; round: string; starts_at: string;
  timezone: string; duration_minutes: number; location: string; notes: string;
  status: "scheduled" | "completed" | "cancelled"; outcome: string; version: number;
};

export const interviewId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function localInterviewTime(instant: string, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(instant));
  const get = (type: string) => parts.find(part => part.type === type)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// Resolve from actual zone offsets, rejecting DST gaps and repeated local times rather than guessing.
export function interviewInstant(local: string, timezone: string) {
  if (!/^20\d{2}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local) || timezone.length > 100) throw new Error("Choose a valid date, time and timezone.");
  const nominal = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(nominal) || new Date(nominal).toISOString().slice(0, 16) !== local) throw new Error("Choose a valid date and time.");
  const offsets = new Set<number>();
  try {
    for (const hours of [-36, -12, 0, 12, 36]) {
      const sample = nominal + hours * 3600000;
      offsets.add(Date.parse(`${localInterviewTime(new Date(sample).toISOString(), timezone)}:00Z`) - sample);
    }
  } catch { throw new Error("Use a valid timezone, such as Asia/Kolkata or UTC."); }
  const matches = [...offsets].map(offset => nominal - offset).filter(time => localInterviewTime(new Date(time).toISOString(), timezone) === local);
  if (matches.length !== 1) throw new Error("This time is skipped or repeated by daylight saving. Use UTC with the confirmed UTC time.");
  return new Date(matches[0]).toISOString();
}

export function parseInterview(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid interview details.");
  const body = value as Record<string, unknown>;
  if (Object.keys(body).some(key => !["id", "application_id", "round", "local_time", "timezone", "duration_minutes", "location", "notes", "status", "outcome", "version"].includes(key)) || !interviewId(body.id) || !interviewId(body.application_id) || !Number.isSafeInteger(body.version) || Number(body.version) < 0) throw new Error("Invalid interview request. Reload and retry.");
  const text = (key: string, max: number, required = false) => {
    if (typeof body[key] !== "string" || (body[key] as string).length > max || (required && !(body[key] as string).trim())) throw new Error(`Check your ${key.replaceAll("_", " ")}.`);
    return (body[key] as string).trim();
  };
  const timezone = text("timezone", 100, true);
  const starts_at = interviewInstant(text("local_time", 16, true), timezone);
  if (!Number.isSafeInteger(body.duration_minutes) || Number(body.duration_minutes) < 5 || Number(body.duration_minutes) > 480 || !["scheduled", "completed", "cancelled"].includes(String(body.status))) throw new Error("Choose a duration from 5–480 minutes and a valid status.");
  return { id: body.id, application_id: body.application_id, round: text("round", 120, true), starts_at, timezone, duration_minutes: Number(body.duration_minutes), location: text("location", 1000), notes: text("notes", 5000), status: body.status as Interview["status"], outcome: text("outcome", 2000), version: Number(body.version) };
}

export function interviewCalendar(event: Interview, title: string, now = new Date()) {
  const date = (value: Date) => value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const escape = (value: string) => value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/;/g, "\\;").replace(/,/g, "\\,");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JobPilot//Interview Planner//EN", "CALSCALE:GREGORIAN", "BEGIN:VEVENT", `UID:${event.id}@jobpilot`, `SEQUENCE:${event.version}`, `DTSTAMP:${date(now)}`, `DTSTART:${date(new Date(event.starts_at))}`, `DTEND:${date(new Date(Date.parse(event.starts_at) + event.duration_minutes * 60000))}`, `SUMMARY:${escape(`${title} · ${event.round}`)}`, `LOCATION:${escape(event.location)}`, `DESCRIPTION:${escape(`Timezone: ${event.timezone}\n${event.notes}\n${event.outcome}`)}`, `STATUS:${event.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`, "END:VEVENT", "END:VCALENDAR"];
  // RFC 5545 folds at 75 UTF-8 octets, without splitting Unicode characters.
  return lines.map(line => {
    let folded = "", width = 0;
    for (const character of line) {
      const bytes = new TextEncoder().encode(character).length;
      if (width + bytes > 75) { folded += "\r\n "; width = 1; }
      folded += character; width += bytes;
    }
    return folded;
  }).join("\r\n") + "\r\n";
}
