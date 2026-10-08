import { createHmac, timingSafeEqual } from "node:crypto";
export type BillingMode = "test" | "live";
export function billingConfiguration() {
  const mode = process.env.BILLING_MODE;
  const key = process.env.RAZORPAY_KEY_ID || "";
  // Live collection stays blocked until merchant, dispute and invoice acceptance is verified.
  const ready = mode === "test" && key.startsWith(`rzp_${mode}_`) && Boolean(process.env.RAZORPAY_KEY_SECRET && process.env.RAZORPAY_WEBHOOK_SECRET);
  return { ready, mode: ready ? mode as BillingMode : null };
}
export function providerId(value: unknown, prefix: string) {
  if (typeof value !== "string" || !new RegExp(`^${prefix}_[a-zA-Z0-9]{6,100}$`).test(value)) throw Error("Invalid provider reference.");
  return value;
}
export function hostedUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2048) throw Error("Invalid checkout link.");
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "rzp.io" || url.username || url.password || url.port) throw Error("Invalid checkout link.");
  return url.href;
}
export function verifyWebhook(raw: string, signature: string | null, secret: string) {
  if (!secret || !signature || !/^[a-fA-F0-9]{64}$/.test(signature)) return false;
  return timingSafeEqual(createHmac("sha256", secret).update(raw).digest(), Buffer.from(signature, "hex"));
}
export async function razorpay(path: string, body?: Record<string, unknown>) {
  if (!billingConfiguration().ready || (!/^\/[a-z_]+(?:\/[a-zA-Z0-9_]+){0,2}$/.test(path) && !/^\/invoices\?subscription_id=sub_[a-zA-Z0-9]{6,100}&count=100$/.test(path))) throw Error("Billing setup is unavailable.");
  const response = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(15000),
    headers: { Authorization: `Basic ${Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString("base64")}`, "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw Error("Payment provider request failed. Reload billing before retrying.");
  return response.json();
}
export function matchedPlan(plan: Record<string, unknown>, amount: number) {
  const item = plan.item as Record<string, unknown> | undefined;
  if (plan.period !== "monthly" || plan.interval !== 1 || item?.currency !== "INR" || item.amount !== amount) throw Error("Provider pricing does not match this product.");
}
