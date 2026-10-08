import {
  billingConfiguration,
  providerId,
  verifyWebhook,
} from "@/lib/billing/provider";
import { reconcileBilling, type Intent } from "@/lib/billing/server";
import { createClient } from "@supabase/supabase-js";
const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(request: Request) {
  if (!billingConfiguration().ready || !process.env.SUPABASE_SECRET_KEY)
    return json({ error: "Billing is unavailable." }, 503);
  try {
    const reader = request.body?.getReader();
    if (!reader) return json({ error: "Invalid event." }, 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > 262144) {
        await reader.cancel();
        return json({ error: "Event too large." }, 413);
      }
      chunks.push(value);
    }
    const raw = Buffer.concat(chunks).toString("utf8");
    if (
      !verifyWebhook(
        raw,
        request.headers.get("x-razorpay-signature"),
        process.env.RAZORPAY_WEBHOOK_SECRET!,
      )
    )
      return json({ error: "Invalid signature." }, 400);
    const eventId = request.headers.get("x-razorpay-event-id");
    if (!eventId || !/^[A-Za-z0-9_-]{8,200}$/.test(eventId))
      return json({ error: "Invalid event reference." }, 400);
    const event = JSON.parse(raw);
    if (typeof event.event !== "string")
      return json({ error: "Invalid event." }, 400);
    if (!/^(subscription|payment_link|payment|refund)\./.test(event.event))
      return json({ ignored: true });
    const disputeId = event.payload?.dispute?.entity?.id;
    const paymentId =
      event.payload?.payment?.entity?.id ||
      event.payload?.refund?.entity?.payment_id ||
      event.payload?.dispute?.entity?.payment_id;
    const resource =
      event.payload?.subscription?.entity?.id ||
      event.payload?.payment_link?.entity?.id;
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let intent: Intent | null = null;
    if (resource) {
      providerId(resource, resource.startsWith("sub_") ? "sub" : "plink");
      const r = await admin
        .from("billing_intents")
        .select("*")
        .eq("provider_resource", resource)
        .eq("mode", billingConfiguration().mode)
        .maybeSingle();
      if (r.error) throw Error();
      intent = r.data;
    } else if (paymentId) {
      providerId(paymentId, "pay");
      const paid = await admin
        .from("billing_payments")
        .select("intent_id")
        .eq("id", paymentId)
        .maybeSingle();
      if (paid.error) throw Error();
      if (paid.data) {
        const r = await admin
          .from("billing_intents")
          .select("*")
          .eq("id", paid.data.intent_id)
          .eq("mode", billingConfiguration().mode)
          .single();
        if (r.error) throw Error();
        intent = r.data;
      }
    }
    if (!intent) {
      // A signed event can arrive before the checkout resource is persisted: retry it.
      const checkout =
        event.payload?.subscription?.entity?.notes?.jobpilot_checkout ||
        event.payload?.payment_link?.entity?.notes?.jobpilot_checkout;
      if (typeof checkout === "string" && /^[a-fA-F0-9-]{36}$/.test(checkout)) {
        const pending = await admin
          .from("billing_intents")
          .select("id")
          .eq("id", checkout)
          .eq("mode", billingConfiguration().mode)
          .maybeSingle();
        if (pending.error || pending.data)
          throw Error("Checkout persistence is pending.");
      }
      if (disputeId) throw Error("Disputed payment mapping needs retry.");
      return json({ ignored: true });
    }
    await reconcileBilling(admin, intent, eventId, paymentId, false, disputeId);
    return json({ received: true });
  } catch {
    return json(
      { error: "Event could not be verified or recorded. Retry safely." },
      503,
    );
  }
}
