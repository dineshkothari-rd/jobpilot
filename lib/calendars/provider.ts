import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Interview } from "../applications/interviews";
export type CalendarProvider = "google" | "outlook";
export const calendarProvider = (value: unknown): value is CalendarProvider => value === "google" || value === "outlook";
export const calendarScope = { google: "https://www.googleapis.com/auth/calendar.events", outlook: "offline_access Calendars.ReadWrite" };
function encryptionKey() {
  const key = Buffer.from(process.env.CALENDAR_ENCRYPTION_KEY || "", "base64");
  if (key.length !== 32) throw Error("Calendar encryption is not configured.");
  return key;
}
export function seal(value: string, purpose: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv); cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString("base64url");
}
export function unseal(value: string, purpose: string) {
  const bytes = Buffer.from(value, "base64url");
  if (bytes.length < 29 || bytes.length > 32000) throw Error("Invalid calendar credential.");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), bytes.subarray(0,12));
  decipher.setAAD(Buffer.from(purpose)); decipher.setAuthTag(bytes.subarray(12,28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString("utf8");
}
export function calendarConfig(provider: CalendarProvider) {
  const prefix = provider === "google" ? "GOOGLE_CALENDAR" : "OUTLOOK_CALENDAR";
  const clientId = process.env[`${prefix}_CLIENT_ID`] || ""; const clientSecret = process.env[`${prefix}_CLIENT_SECRET`] || "";
  let origin = "";
  try { const site = new URL(process.env.NEXT_PUBLIC_SITE_URL || ""); if (site.protocol === "https:" && !site.username && !site.password) origin = site.origin; } catch { /* Setup pending. */ }
  let ready = false;
  try { encryptionKey(); ready = Boolean(origin && clientId && clientSecret && process.env.SUPABASE_SECRET_KEY); } catch { /* Setup pending. */ }
  return { ready, origin, clientId, clientSecret, redirectUri: `${origin}/api/calendars/callback`, tokenUrl: provider === "google" ? "https://oauth2.googleapis.com/token" : "https://login.microsoftonline.com/common/oauth2/v2.0/token" };
}
export function beginCalendarOAuth(provider: CalendarProvider, userId: string) {
  const config = calendarConfig(provider); if (!config.ready) throw Error("Calendar connection setup is pending.");
  const verifier = randomBytes(32).toString("base64url"); const state = randomBytes(32).toString("base64url");
  const cookie = seal(JSON.stringify({ provider, userId, state, verifier, expires: Date.now() + 600000 }), "calendar-oauth");
  const url = new URL(provider === "google" ? "https://accounts.google.com/o/oauth2/v2/auth" : "https://login.microsoftonline.com/common/oauth2/v2.0/authorize");
  const params = { client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: calendarScope[provider], state, code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256", prompt: provider === "google" ? "consent select_account" : "select_account" };
  Object.entries(params).forEach(([key,value])=>url.searchParams.set(key,value));
  if (provider === "google") url.searchParams.set("access_type", "offline");
  return { url: url.href, cookie };
}
export function readCalendarOAuth(cookie: string, state: string, userId: string) {
  const value = JSON.parse(unseal(cookie, "calendar-oauth"));
  const expected = Buffer.from(value.state || ""); const actual = Buffer.from(state);
  if (!calendarProvider(value.provider) || value.userId !== userId || !Number.isFinite(value.expires) || value.expires <= Date.now() || expected.length !== actual.length || !timingSafeEqual(expected, actual) || typeof value.verifier !== "string") throw Error("Calendar authorization expired or does not match this account.");
  return value as { provider: CalendarProvider; verifier: string };
}
export async function calendarTokens(provider: CalendarProvider, grant: Record<string,string>) {
  const config = calendarConfig(provider);
  const response = await fetch(config.tokenUrl, { method: "POST", redirect: "error", signal: AbortSignal.timeout(15000), headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...grant }) });
  if (!response.ok) throw Error("Calendar authorization failed. Reconnect your calendar.");
  const token = await response.json();
  if (typeof token.access_token !== "string" || !token.access_token || token.access_token.length > 16000 || typeof token.expires_in !== "number" || !Number.isFinite(token.expires_in) || token.expires_in <= 0 || token.expires_in > 172800 || token.refresh_token && (typeof token.refresh_token !== "string" || token.refresh_token.length > 16000)) throw Error("Invalid calendar authorization response.");
  return token as { access_token: string; refresh_token?: string; expires_in: number; scope?: string };
}
export function calendarEventBody(provider: CalendarProvider, event: Interview) {
  const cancelled = event.status === "cancelled";
  const title = `${cancelled ? "[Cancelled] " : ""}JobPilot: ${event.round}`;
  const start = new Date(event.starts_at).toISOString(); const end = new Date(Date.parse(event.starts_at)+event.duration_minutes*60000).toISOString();
  // Only scheduling fields leave JobPilot; preparation notes/outcomes remain private.
  return provider === "google" ? { summary: title, location: event.location, start: { dateTime: start }, end: { dateTime: end }, transparency: cancelled ? "transparent" : "opaque" }
    : { subject: title, location: { displayName: event.location }, start: { dateTime: start.slice(0,-1), timeZone: "UTC" }, end: { dateTime: end.slice(0,-1), timeZone: "UTC" }, showAs: cancelled ? "free" : "busy" };
}
export function importedCalendarEvent(provider: CalendarProvider, remote: Record<string,unknown>, current: Interview): Partial<Interview> {
  if (remote.status === "cancelled" || remote.isCancelled === true) return { status: "cancelled" };
  if (remote.isAllDay || remote.recurrence || remote.recurringEventId || remote.type && remote.type !== "singleInstance") throw Error("Recurring calendar events cannot be imported into one interview round.");
  const start = remote.start as { dateTime?: unknown; timeZone?: unknown } | undefined; const end = remote.end as { dateTime?: unknown; timeZone?: unknown } | undefined;
  if (typeof start?.dateTime !== "string" || typeof end?.dateTime !== "string") throw Error("All-day or invalid calendar events cannot be imported.");
  const instant = (part: { dateTime?: unknown; timeZone?: unknown }) => {
    let value = part.dateTime as string;
    if (provider === "outlook" && !/(Z|[+-]\d\d:\d\d)$/i.test(value)) { if (part.timeZone !== "UTC") throw Error("Calendar time must be returned in UTC."); value += "Z"; }
    if (!/(Z|[+-]\d\d:\d\d)$/i.test(value) || !Number.isFinite(Date.parse(value))) throw Error("Invalid calendar time.");
    return Date.parse(value);
  };
  const begins = instant(start); const minutes = (instant(end)-begins)/60000;
  const title = provider === "google" ? remote.summary : remote.subject;
  const location = provider === "google" ? remote.location : (remote.location as { displayName?: unknown } | undefined)?.displayName;
  if (typeof title !== "string" || typeof location !== "undefined" && typeof location !== "string") throw Error("Invalid calendar details.");
  const round = title.replace(/^\[Cancelled\] /,"").trim().replace(/^JobPilot: /, "").trim();
  if (!round || round.length > 120 || (location as string || "").length > 1000 || !Number.isInteger(minutes) || minutes < 5 || minutes > 480) throw Error("Calendar details exceed interview limits (title 120 characters, duration 5–480 minutes).");
  return { round, starts_at: new Date(begins).toISOString(), timezone: current.timezone, duration_minutes: minutes, location: location as string || "", status: title.startsWith("[Cancelled] ") ? "cancelled" : current.status === "completed" ? "completed" : "scheduled" };
}
export async function calendarRequest(provider: CalendarProvider, token: string, eventId = "", method = "GET", body?: unknown, etag?: string) {
  if ([".", ".."].includes(eventId)) throw Error("Invalid calendar event identifier.");
  const base = provider === "google" ? "https://www.googleapis.com/calendar/v3/calendars/primary/events" : "https://graph.microsoft.com/v1.0/me/events";
  const url = `${base}${eventId ? "/" + encodeURIComponent(eventId) : ""}${provider === "google" && method !== "GET" ? "?sendUpdates=none" : ""}`;
  return fetch(url, { method, redirect: "error", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(provider === "outlook" ? { Prefer: 'outlook.timezone="UTC", IdType="ImmutableId"' } : {}), ...(etag ? { "If-Match": etag } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
}
