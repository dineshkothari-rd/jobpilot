import { ECDH } from "node:crypto";

export type NotificationPreferences = { email_enabled: boolean; push_enabled: boolean; timezone: string };
export function parsePreferences(value: unknown): NotificationPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid preferences.");
  const input = value as Record<string, unknown>;
  if (Object.keys(input).some(key => !["email_enabled", "push_enabled", "timezone"].includes(key)) || typeof input.email_enabled !== "boolean" || typeof input.push_enabled !== "boolean" || typeof input.timezone !== "string" || input.timezone.length > 100) throw Error("Invalid preferences.");
  try { new Intl.DateTimeFormat("en", { timeZone: input.timezone }); } catch { throw Error("Choose a valid timezone."); }
  return { email_enabled: input.email_enabled, push_enabled: input.push_enabled, timezone: input.timezone };
}

export function pushEndpoint(value: unknown): string {
  if (typeof value !== "string" || value.length > 2048) throw Error("Invalid browser subscription.");
  let url: URL;
  try { url = new URL(value); } catch { throw Error("Invalid browser subscription."); }
  // Restrict outbound requests to browser push providers, never user-controlled hosts.
  const host = url.hostname;
  const allowed = host === "fcm.googleapis.com" || host === "updates.push.services.mozilla.com" || host.endsWith(".notify.windows.com") || host === "web.push.apple.com" || host.endsWith(".push.apple.com");
  if (!allowed || url.protocol !== "https:" || url.port || url.username || url.password || url.hash) throw Error("This browser push provider is not supported.");
  return url.href;
}
export function parseSubscription(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid browser subscription.");
  const input = value as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };
  const endpoint = pushEndpoint(input.endpoint);
  const p256dh = input.keys?.p256dh;
  const auth = input.keys?.auth;
  if (typeof p256dh !== "string" || typeof auth !== "string" || !/^[\w-]{87}=?$/.test(p256dh) || !/^[\w-]{22}={0,2}$/.test(auth)) throw Error("Invalid browser encryption keys.");
  const publicKey = Buffer.from(p256dh, "base64url");
  if (publicKey.length !== 65 || publicKey[0] !== 4 || Buffer.from(auth, "base64url").length !== 16) throw Error("Invalid browser encryption keys.");
  try { ECDH.convertKey(publicKey, "prime256v1"); } catch { throw Error("Invalid browser encryption keys."); }
  return { endpoint, p256dh, auth };
}
export function reminderConfiguration() {
  const site = process.env.NEXT_PUBLIC_SITE_URL || "";
  let siteUrl = "";
  try { const url = new URL(site); if (url.protocol === "https:" && !url.username && !url.password) siteUrl = url.origin; } catch { /* Configuration pending. */ }
  const background = Boolean(process.env.CRON_SECRET && process.env.SUPABASE_SECRET_KEY && siteUrl);
  return { siteUrl, email: background && Boolean(process.env.RESEND_API_KEY && process.env.REMINDER_FROM_EMAIL), push: background && Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY), publicKey: process.env.VAPID_PUBLIC_KEY || "" };
}
export function calendarDay(now: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}
export function followUpDue(value: string | null, now: Date, timezone: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return false;
  // Follow-ups are saved as instants by the pipeline; use the user’s chosen timezone.
  const date = calendarDay(new Date(value), timezone);
  const today = calendarDay(now, timezone);
  const tomorrow = new Date(`${today}T12:00:00Z`); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  return date >= today && date <= tomorrow.toISOString().slice(0, 10);
}
export function interviewDue(value: string, now: Date) {
  const instant = Date.parse(value);
  return instant >= now.getTime() && instant <= now.getTime() + 26 * 60 * 60 * 1000;
}
export function activeApplication(status: string) { return status !== "rejected" && status !== "withdrawn"; }
