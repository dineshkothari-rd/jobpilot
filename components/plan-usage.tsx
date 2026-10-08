"use client";
import { Button } from "@/components/ui/button";
import {
  meterNames,
  remainingAllowance,
  type Allowance,
} from "@/lib/plans/policy";
import Link from "next/link";
import { useEffect, useState } from "react";
export function PlanUsage() {
  const [data, setData] = useState<{
      allowances: Allowance[];
      plan_name?: string;
      expires_at?: string | null;
      recruiter: boolean;
      resets_at: string;
    } | null>(null),
    [error, setError] = useState(""),
    [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/plans/usage", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const value = await response.json();
        if (!response.ok)
          throw Error(value.error || "Unable to load allowance.");
        setData(value);
        setError("");
      })
      .catch((cause) => {
        if (!controller.signal.aborted) {
          setData(null);
          setError(cause.message);
        }
      });
    return () => controller.abort();
  }, [revision]);
  return (
    <section className="rounded-2xl border bg-background p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-semibold">Plan and usage</h2>
        <Button
          variant="outline"
          onClick={() => setRevision((value) => value + 1)}
        >
          Refresh allowance
        </Button>
      </div>
      <p className="mt-2 text-sm">
        {data?.plan_name || "Your plan"}. View billing for your subscription and renewal state.{" "}
        <Link className="underline" href="/plans">
          View launch limits
        </Link>
      </p>
      <Link href="/billing" className="mt-3 inline-block text-sm underline">Plans, posting credits and payment history</Link>
      {error && (
        <p className="mt-3 text-destructive" role="alert">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="mt-3" role="status">
          Loading allowance…
        </p>
      )}
      {data && (
        <>
          {data.expires_at && (
            <p className="mt-2 text-sm">
              Current plan access through{" "}
              {new Date(data.expires_at).toLocaleString()}; then free launch
              limits apply.
            </p>
          )}
          <ul className="mt-3 space-y-3">
            {data.allowances
              .filter(
                (row) =>
                  data.recruiter ||
                  !["candidate_search", "active_postings"].includes(row.meter),
              )
              .map((row) => (
                <li key={row.meter} className="rounded-lg border p-3 text-sm">
                  <p>{meterNames[row.meter]}</p>
                  <p className="mt-1">
                    {row.used} / {row.limit} used ·{" "}
                    {remainingAllowance(row.limit, row.used)} remaining{" "}
                    {row.period === "active" ? "open slots" : "today"}
                  </p>
                  {row.used >= row.limit && (
                    <p className="mt-1">
                      {row.period === "active"
                        ? "Close an old posting to free a slot."
                        : "Daily allowance reached. Wait for the next reset."}
                    </p>
                  )}
                </li>
              ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Daily reset: {new Date(data.resets_at).toLocaleString()}. Admitted
            attempts count even if processing later fails. Manual/scheduled
            Autopilot share a counter; other safety limits still apply.
          </p>
        </>
      )}
    </section>
  );
}
