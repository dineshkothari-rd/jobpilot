"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
type Delivery = { id: string; kind: string; run_day: string; channel: string; status: string; attempts: number; sent_at: string | null; lease_until: string };
export function NotificationHistory() {
  const [rows, setRows] = useState<Delivery[] | null>(null), [error, setError] = useState(""), [more, setMore] = useState(false), [checkedAt, setCheckedAt] = useState(""), [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/notifications/history", { cache: "no-store", signal: controller.signal }).then(async response => {
      const data = await response.json();
      if (!response.ok) throw Error(data.error || "Unable to load delivery history.");
      setRows(data.history); setMore(data.more); setCheckedAt(data.checked_at); setError("");
    }).catch(cause => { if (!controller.signal.aborted) { setRows(null); setError(cause.message); } });
    return () => controller.abort();
  }, [revision]);
  return <section className="rounded-2xl border bg-background p-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold">Alert and reminder delivery history</h2><Button variant="outline" onClick={() => setRevision(value => value + 1)}>Refresh delivery history</Button></div>
    <p className="mt-2 text-sm text-muted-foreground">Up to 25 attempts from the last 30 days. Provider acceptance does not confirm receipt in your inbox or on your device. Failed attempts can retry during the same day, up to three times.</p>
    {error && <p role="alert" className="mt-3 text-destructive">{error}</p>}
    {!rows && !error && <p role="status" className="mt-3">Loading history…</p>}
    {rows?.length === 0 && <p className="mt-3 text-sm">No delivery attempts recorded. Check your alert/reminder preferences and connect this browser for push. Only matching jobs and upcoming scheduled events trigger reminders.</p>}
    <ul className="mt-3 space-y-3">{rows?.map(row => <li key={`${row.kind}/${row.id}`} className="rounded-lg border p-3 text-sm">
      <p>{row.kind === "job_alert" ? "Job alert" : "Interview/follow-up reminder"} · {row.channel} · {row.run_day} (UTC)</p>
      <p className="mt-1">{row.status === "sent" ? "Accepted by provider" : row.status === "failed" ? "Attempt failed" : Date.parse(row.lease_until) < Date.parse(checkedAt) ? "Attempt incomplete" : "Sending"} · Attempt {row.attempts} of 3</p>
    </li>)}</ul>
    {more && <p className="mt-3 text-sm">Showing the latest 25 attempts. Full owned history is available in your account data export.</p>}
  </section>;
}
