"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { REPORT_CATEGORIES } from "@/lib/jobs/reports";

type Report = { id: string; job_id: string; category: keyof typeof REPORT_CATEGORIES; details: string; created_at: string; jobs: { title: string; company_name: string } | null };

export default function ModerationPage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState("");
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    let ignore = false;
    async function load() {
      setLoading(true); setError("");
    try {
      const response = await fetch("/api/jobs/reports"); const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to load reports.");
      if (!ignore) setReports(data.reports);
    } catch (error) { if (!ignore) setError(error instanceof Error ? error.message : "Unable to load reports."); }
    finally { if (!ignore) setLoading(false); }
    }
    void load();
    return () => { ignore = true; };
  }, [revision]);

  async function review(id: string, status: "confirmed" | "dismissed") {
    if (saving) return;
    setSaving(id); setError(""); setNotice("");
    try {
      const response = await fetch("/api/jobs/reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status, note: notes[id] || "" }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error || "Unable to save decision.");
      setReports(current => current.filter(report => report.id !== id));
      setNotice(status === "confirmed" ? "Report confirmed. The job is hidden from discovery and Autopilot." : "Report dismissed. Listing visibility is unchanged.");
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to save decision."); }
    finally { setSaving(""); }
  }

  return <main className="mx-auto w-full max-w-4xl space-y-5 p-5 pb-24 sm:p-8">
    <Link className="text-sm text-primary underline" href="/company-verifications">Review company verifications →</Link>
    <header><h1 className="text-2xl font-bold">Job report moderation</h1><p className="mt-2 text-sm text-muted-foreground">Review pending concerns. Confirming a scam immediately hides the listing. Admin access is required.</p></header>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <Button variant="outline" onClick={() => setRevision(value => value + 1)} disabled={loading || Boolean(saving)}>Refresh queue</Button>
    {loading ? <p role="status">Loading reports…</p> : !error && reports.length === 0 ? <p>No pending reports.</p> : error ? null : reports.map(report => <article key={report.id} className="surface space-y-3 p-5">
      <Link href={`/jobs/${report.job_id}`} className="font-semibold text-primary underline">{report.jobs?.title || "Job listing"}{report.jobs?.company_name ? ` · ${report.jobs.company_name}` : ""}</Link>
      <p className="text-xs text-muted-foreground">{REPORT_CATEGORIES[report.category]} · {new Date(report.created_at).toLocaleString("en-IN")}</p>
      <p className="whitespace-pre-wrap break-words text-sm">{report.details}</p>
      <label className="block text-sm font-semibold">Review note<textarea rows={2} maxLength={2000} value={notes[report.id] || ""} onChange={event => setNotes(current => ({ ...current, [report.id]: event.target.value }))} className="mt-2 w-full rounded-xl border bg-background p-3 text-sm" /></label>
      <div className="flex flex-wrap gap-2"><Button variant="destructive" disabled={Boolean(saving) || !notes[report.id]?.trim()} onClick={() => void review(report.id, "confirmed")}>Confirm scam &amp; hide job</Button><Button variant="outline" disabled={Boolean(saving) || !notes[report.id]?.trim()} onClick={() => void review(report.id, "dismissed")}>Dismiss report</Button></div>
    </article>)}
    {reports.length === 100 && <p className="text-xs text-muted-foreground">Showing the oldest 100 pending reports. Review these and refresh to see the next batch.</p>}
  </main>;
}
