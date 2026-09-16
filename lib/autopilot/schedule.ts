import { timingSafeEqual } from "node:crypto";

export function authorizedCron(header: string | null, secret?: string) {
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function backgroundConfigured() {
  return Boolean(process.env.CRON_SECRET && process.env.SUPABASE_SECRET_KEY);
}

export function shouldPrepare(status: unknown) {
  return status !== "prepared" && status !== "submitted";
}
