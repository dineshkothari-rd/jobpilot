import { billingConfiguration } from "@/lib/billing/provider";
import {
  reconcileBilling,
  recoverBilling,
  type Intent,
} from "@/lib/billing/server";
import { json, recruiterContext, requestBody } from "@/lib/recruiter/server";
import { uuid } from "@/lib/recruiter/validation";
import { randomUUID } from "node:crypto";
export async function GET() {
  try {
    const c = await recruiterContext();
    if (c.response) return c.response;
    const [products, intents, payments, balances, plan] = await Promise.all([
      c.admin
        .from("billing_products")
        .select("id,name,kind,plan_id,amount_minor,currency,credits")
        .order("amount_minor"),
      c.admin
        .from("billing_intents")
        .select("id,product_id,mode,status,disputed,created_at")
        .eq("user_id", c.user.id)
        .order("created_at", { ascending: false })
        .limit(50),
      c.admin
        .from("billing_payments")
        .select(
          "id,amount_minor,refunded_minor,paid_at,invoice_url,billing_intents!inner(mode)",
        )
        .eq("user_id", c.user.id)
        .order("paid_at", { ascending: false })
        .limit(50),
      c.admin
        .from("posting_credit_balance")
        .select("mode,balance")
        .eq("user_id", c.user.id),
      c.admin.rpc("effective_launch_plan", { p_user: c.user.id }),
    ]);
    if ([products, intents, payments, balances, plan].some((r) => r.error))
      return json({ error: "Billing information unavailable." }, 503);
    return json({
      configuration: billingConfiguration(),
      products: products.data,
      intents: intents.data,
      payments: payments.data,
      balances: balances.data,
      plan: plan.data,
    });
  } catch {
    return json({ error: "Unable to load billing." }, 503);
  }
}
export async function PATCH(request: Request) {
  try {
    const c = await recruiterContext(request);
    if (c.response) return c.response;
    if (!billingConfiguration().ready)
      return json({ error: "Payment provider setup is pending." }, 503);
    let id: string, action: string, reference: string | undefined;
    try {
      const b = await requestBody(request);
      if (
        !b ||
        Object.keys(b).some(
          (k) => !["id", "action", "reference"].includes(k),
        ) ||
        !["cancel", "cancel_now", "refresh", "recover"].includes(b.action)
      )
        throw Error();
      id = uuid(b.id);
      action = b.action;
      if (action === "recover") {
        if (typeof b.reference !== "string" || b.reference.length > 110)
          throw Error();
        reference = b.reference;
      } else if (b.reference !== undefined) throw Error();
    } catch {
      return json({ error: "Choose a billing action." }, 400);
    }
    const r = await c.admin
      .from("billing_intents")
      .select("*")
      .eq("id", id)
      .eq("user_id", c.user.id)
      .single();
    if (r.error || !r.data || r.data.mode !== billingConfiguration().mode)
      return json({ error: "Checkout not found." }, 404);
    let intent = r.data as Intent;
    if (action === "recover")
      intent = await recoverBilling(c.admin, intent, reference!);
    if (!intent.provider_resource)
      return json(
        {
          error:
            "This checkout needs support recovery. No duplicate checkout will be created.",
        },
        409,
      );
    if (["cancel","cancel_now"].includes(action) && !intent.provider_resource.startsWith("sub_"))
      return json(
        { error: "Only subscriptions have a renewal to cancel." },
        400,
      );
    await reconcileBilling(
      c.admin,
      intent,
      `manual_${randomUUID()}`,
      undefined,
      action === "cancel_now" ? "immediate" : action === "cancel",
    );
    return json({ saved: true });
  } catch {
    return json(
      {
        error:
          "Billing update failed. Reload before retrying; a provider timeout can be ambiguous.",
      },
      503,
    );
  }
}
