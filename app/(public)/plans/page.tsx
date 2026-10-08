import { billingConfiguration } from "@/lib/billing/provider";
import { meterNames, type Meter } from "@/lib/plans/policy";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
export const metadata = {
  title: "Plans and pricing",
  description:
    "Compare Parth Careers Free, Candidate Pro and recruiter subscription plans.",
  alternates: { canonical: "/plans" },
};
export default async function PlansPage() {
  const client = await createClient();
  const result = await client
    .from("launch_limits")
    .select("meter,limit_value,period")
    .order("meter");
  if (result.error || !result.data?.length)
    throw Error("Launch plans are unavailable.");
  const tiers = await client
    .from("launch_plans")
    .select("id,name,autopilot,candidate_search,interview_ai,active_postings")
    .order("id");
  if (tiers.error) throw Error("Plan catalogue unavailable.");
  const products = await client
    .from("billing_products")
    .select("id,name,kind,plan_id,amount_minor,credits")
    .order("amount_minor");
  if (products.error) throw Error("Pricing unavailable.");
  if (
    tiers.data?.some(
      (t) =>
        !products.data?.some(
          (p) => p.plan_id === t.id && p.kind === "subscription",
        ),
    )
  )
    throw Error("Plan pricing unavailable.");
  const checkout = billingConfiguration();
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Plans and pricing</h1>
        <p className="mt-3 text-muted-foreground">
          Start on the ₹0 Free plan. Upgrade to Candidate Pro or a recruiter
          subscription for higher allowances.
        </p>
      </header>
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="rounded-2xl border p-5">
          <h2 className="text-xl font-semibold">Candidates</h2>
          <p className="mt-3">
            Browse jobs, save searches, track applications, prepare for
            interviews and control recruiter visibility.
          </p>
          <Link
            className="mt-4 inline-block underline"
            href="/auth/login?next=/dashboard"
          >
            Start free
          </Link>
        </article>
        <article className="rounded-2xl border p-5">
          <h2 className="text-xl font-semibold">Recruiters</h2>
          <p className="mt-3">
            Register and verify your company, publish openings, search
            consenting candidates and manage applications.
          </p>
          <Link
            className="mt-4 inline-block underline"
            href="/auth/login?next=/recruiter"
          >
            Register your company
          </Link>
        </article>
      </div>
      <article className="rounded-2xl border p-5">
        <h2 className="text-xl font-semibold">Free plan allowances</h2>
        <ul className="mt-3 space-y-2">
          {result.data.map((row) => (
            <li key={row.meter}>
              {meterNames[row.meter as Meter]}:{" "}
              <strong>{row.limit_value}</strong>{" "}
              {row.period === "active" ? "open at a time" : "per UTC day"}
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-muted-foreground">
          Daily counters reset at 00:00 UTC (05:30 IST). Admitted attempts count
          even if processing later fails. Manual and scheduled Autopilot share
          an allowance; your existing package limit also applies. Each candidate
          search page counts as a request. Closing a posting frees an open slot.
          Interview AI actions use the included practice engine; these are not
          purchased AI credits.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Other safety limits still apply to applications, messaging,
          verification and support. Your Profile shows current allowance usage.
          Email/push and calendar integrations require separate setup; this page
          does not promise delivery.
        </p>
      </article>
      <article className="rounded-2xl border p-5">
        <h2 className="text-xl font-semibold">Monthly subscriptions</h2>
        <p className="mt-3 text-sm">
          Plans renew monthly for up to 12 cycles. Cancel future renewal from
          billing. Recruiter plans require a verified company. Expiry restores
          Free limits without resetting usage.
        </p>
        <ul className="mt-3 space-y-3">
          {tiers.data?.map((tier) => (
            <li key={tier.id}>
              <strong>{tier.name}</strong>
              <p>
                INR{" "}
                {(
                  (products.data?.find((p) => p.plan_id === tier.id)
                    ?.amount_minor || 0) / 100
                ).toFixed(2)}{" "}
                per month
              </p>
              <p className="text-sm">
                {tier.autopilot} Autopilot attempts, {tier.candidate_search}{" "}
                search requests, {tier.interview_ai} interview AI actions per
                UTC day; {tier.active_postings} open postings.
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-3">
          {checkout.ready && checkout.mode === "live"
            ? "Secure hosted checkout is available after sign-in."
            : checkout.mode === "test"
              ? "Checkout is currently in test mode; test purchases do not grant live access."
              : "Payment setup is pending; checkout is currently unavailable."}
        </p>
        <Link
          href="/auth/login?next=/billing"
          className="mt-3 inline-block underline"
        >
          View plans and billing
        </Link>
      </article>
      <article className="rounded-2xl border p-5">
        <h2 className="text-xl font-semibold">Recruiter posting packages</h2>
        <ul className="mt-3 space-y-2">
          {products.data
            ?.filter((p) => p.kind === "posting_pack")
            .map((p) => (
              <li key={p.id}>
                <strong>{p.name}</strong>: INR{" "}
                {(p.amount_minor / 100).toFixed(2)} one time · {p.credits}{" "}
                posting credits
              </li>
            ))}
        </ul>
        <p className="mt-3 text-sm">
          When paid posting is active, one credit publishes a new opening.
          Pausing and resuming that opening does not spend twice.
        </p>
      </article>
      <Link className="underline" href="/help">
        Questions? Contact support
      </Link>
    </section>
  );
}
