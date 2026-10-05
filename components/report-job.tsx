"use client";

import { Dialog } from "@base-ui/react/dialog";
import { Flag, X } from "lucide-react";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { REPORT_CATEGORIES } from "@/lib/jobs/reports";

export function ReportJob({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState("payment");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError("");
    try {
      const response = await fetch("/api/jobs/reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ job_id: jobId, category, details }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Unable to submit the report.");
      setSent(true);
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to submit the report."); }
    finally { setSaving(false); }
  }

  return <Dialog.Root open={open} onOpenChange={(value) => !saving && setOpen(value)}>
    <Dialog.Trigger className={buttonVariants({ variant: "ghost", size: "sm" })}><Flag className="size-3.5" />Report job</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-50 bg-foreground/20 backdrop-blur-sm" />
      <Dialog.Popup className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-background p-5 shadow-xl">
        <div className="flex items-center justify-between gap-3"><Dialog.Title className="text-lg font-bold">Report a safety concern</Dialog.Title><Dialog.Close disabled={saving} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Close report"><X /></Dialog.Close></div>
        <Dialog.Description className="mt-2 text-sm text-muted-foreground">Reports are private and reviewed by moderators. A report alone does not remove the listing.</Dialog.Description>
        {sent ? <p role="status" className="mt-4 text-sm">Your report has been received. A moderator will review it.</p> : <form onSubmit={submit} className="mt-4 space-y-4">
          <label className="block text-sm font-semibold">Concern<select value={category} onChange={(event) => setCategory(event.target.value)} className="mt-2 h-11 w-full rounded-xl border bg-background px-3 text-sm">{Object.entries(REPORT_CATEGORIES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <label className="block text-sm font-semibold">What happened?<textarea value={details} onChange={(event) => setDetails(event.target.value)} required minLength={10} maxLength={2000} rows={4} className="mt-2 w-full rounded-xl border bg-background p-3 text-sm" placeholder="Describe the concern and relevant public evidence. Do not include passwords or financial account details." /></label>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={saving || details.trim().length < 10}>{saving ? "Submitting…" : "Submit report"}</Button>
        </form>}
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
