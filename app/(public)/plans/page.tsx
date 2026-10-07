import { meterNames, type Meter } from "@/lib/plans/policy";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
export const metadata = {
  title: "Free launch plans",
  description: "JobPilot's free first-launch access and clear usage limits.",
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
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold">Free first launch</h1>
        <p className="mt-3 text-muted-foreground">
          ₹0. No card, subscription or automatic renewal. Paid plans and
          upgrades are not available yet.
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
        <h2 className="text-xl font-semibold">Launch allowances</h2>
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
          Interview AI actions use the free launch engine; these are not
          purchased AI credits.
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Other safety limits still apply to applications, messaging,
          verification and support. Your Profile shows current allowance usage.
          Email/push and calendar integrations require separate setup; this page
          does not promise delivery.
        </p>
      </article>
      <Link className="underline" href="/help">
        Questions? Contact support
      </Link>
    </section>
  );
}
