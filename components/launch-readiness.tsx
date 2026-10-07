"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
type Run = { id: string; state: string; started_at: string; finished_at: string | null; completed: number; failed: number; skipped: number };
type Readiness = {
  checked_at: string;
  configuration: { name: string; configured: boolean; detail: string }[];
  workers: { worker: string; health: string; runs: Run[] }[];
  pending_release_checks: string[];
};
export function LaunchReadiness() {
  const [value, setValue] = useState<Readiness | null>(null), [error, setError] = useState(""), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/admin/readiness", { cache: "no-store", signal: controller.signal }).then(async response => {
      const body = await response.json();
      if (!response.ok) throw Error(body.error || "Unable to load readiness.");
      setValue(body); setError("");
    }).catch(cause => { if (!controller.signal.aborted) { setValue(null); setError(cause.message); } });
    return () => controller.abort();
  }, [revision]);
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-xl font-semibold">Launch readiness</h2><Button variant="outline" onClick={() => setRevision(v => v + 1)}>Refresh readiness</Button></div>
    <p className="text-sm text-muted-foreground">Configuration and observed job runs. These checks do not certify delivery, recovery or revenue readiness.</p>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {!value && !error && <p role="status">Loading launch checks…</p>}
    {value && <>
      <p className="text-sm">Checked {new Date(value.checked_at).toLocaleString()}</p>
      <div className="grid gap-3 sm:grid-cols-2">{value.configuration.map(row => <article key={row.name} className="rounded-xl border p-4"><h3 className="font-semibold">{row.name} · {row.configured ? "Configured — verification pending" : "Setup pending"}</h3><p className="mt-2 text-sm text-muted-foreground">{row.detail}</p></article>)}</div>
      {value.workers.map(group => <article key={group.worker} className="rounded-xl border p-4"><h3 className="font-semibold capitalize">{group.worker.replaceAll("_", " ")} · {group.health.replaceAll("_", " ")}</h3>
        {group.health === "unavailable" && <p role="alert">Run history is unavailable. Check database setup and hosting logs.</p>}
        {group.health === "never_run" && <p className="mt-2 text-sm">No recorded run yet. This does not confirm the schedule is working.</p>}
        {group.health === "overdue" && <p role="alert">No recent run in the last 36 hours. Check hosting cron configuration.</p>}
        {group.health === "abandoned" && <p role="alert">A run has no final status after 10 minutes. Check hosting logs before retrying.</p>}
        <ul className="mt-3 space-y-2 text-sm">{group.runs.map(run => <li key={run.id} className="break-words">{new Date(run.started_at).toLocaleString()} · {run.state} · {group.worker === "autopilot" ? "Completed" : "Provider accepted"}: {run.completed} · Failed: {run.failed} · Skipped: {run.skipped}</li>)}</ul>
      </article>)}
      <article className="rounded-xl border p-4"><h3 className="font-semibold">Release checks still requiring acceptance</h3><ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{value.pending_release_checks.map(check => <li key={check}>{check}</li>)}</ul></article>
    </>}
  </section>;
}
