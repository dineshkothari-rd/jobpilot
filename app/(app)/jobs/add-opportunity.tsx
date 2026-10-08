"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { Plus, X } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";

const input = "mt-1 min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/40";
const initial = { title: "", company: "", url: "", description: "", location: "", country: "", employment_type: "", skills: "", expires_on: "" };

export function AddOpportunity({ onAdded }: { onAdded: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const requestId = useRef("");
  const dirty = Object.values(draft).some(Boolean);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const close = () => {
    if (busy || (dirty && !window.confirm("Discard this opportunity draft?"))) return;
    setOpen(false);
    setDraft(initial);
    setError("");
    requestId.current = "";
  };
  const save = async () => {
    if (busy) return;
    setBusy(true); setError(""); requestId.current ||= crypto.randomUUID();
    try {
      const response = await fetch("/api/jobs/manual", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ request_id: requestId.current, ...draft }), signal: AbortSignal.timeout(15000) });
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error || "We couldn’t add this opportunity.");
      setDraft(initial); setOpen(false); requestId.current = "";
      await onAdded().catch(() => undefined);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Your draft is still here. Retry shortly."); }
    finally { setBusy(false); }
  };
  const update = (key: keyof typeof draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  return <Dialog.Root open={open} onOpenChange={next => next ? setOpen(true) : close()}>
    <Dialog.Trigger className={buttonVariants({ size: "sm" })}><Plus />Add a job</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Backdrop className="fixed inset-0 z-[60] min-h-dvh bg-foreground/35 backdrop-blur-sm transition-opacity data-ending-style:opacity-0 data-starting-style:opacity-0" />
      <Dialog.Popup className="fixed inset-x-0 bottom-0 z-[61] max-h-[92dvh] overflow-y-auto rounded-t-3xl border bg-background p-5 shadow-2xl transition-transform duration-200 data-ending-style:translate-y-full data-starting-style:translate-y-full sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(680px,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
    <div className="flex items-start justify-between gap-3"><div><Dialog.Title className="font-bold">Add a job you found</Dialog.Title><Dialog.Description className="mt-1 text-xs leading-5 text-muted-foreground">Paste the original employer or job-board link. We’ll match your facts; Parth Careers won’t scrape a blocked page or invent missing details.</Dialog.Description></div><Button variant="ghost" size="icon-sm" disabled={busy} onClick={close} aria-label="Close add job form"><X /></Button></div>
    <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="text-xs font-semibold">Role title<input required maxLength={200} value={draft.title} onChange={event => update("title", event.target.value)} className={input} /></label>
      <label className="text-xs font-semibold">Company<input required maxLength={200} value={draft.company} onChange={event => update("company", event.target.value)} className={input} /></label>
      <label className="text-xs font-semibold sm:col-span-2">Original HTTPS job link<input required type="url" maxLength={2000} value={draft.url} onChange={event => update("url", event.target.value)} placeholder="https://company.example/jobs/role" className={input} /></label>
      <label className="text-xs font-semibold">Location<input maxLength={300} value={draft.location} onChange={event => update("location", event.target.value)} placeholder="Remote, Jaipur…" className={input} /></label>
      <label className="text-xs font-semibold">Country<input maxLength={100} value={draft.country} onChange={event => update("country", event.target.value)} className={input} /></label>
      <label className="text-xs font-semibold">Employment type<input maxLength={100} value={draft.employment_type} onChange={event => update("employment_type", event.target.value)} placeholder="Full-time, contract…" className={input} /></label>
      <label className="text-xs font-semibold">Closing date, if listed<input type="date" value={draft.expires_on} onChange={event => update("expires_on", event.target.value)} className={input} /></label>
      <label className="text-xs font-semibold sm:col-span-2">Skills from the listing<input maxLength={2000} value={draft.skills} onChange={event => update("skills", event.target.value)} placeholder="Excel, recruiting, React…" className={input} /><span className="mt-1 block font-normal text-muted-foreground">Comma-separated; only enter skills actually stated in the listing.</span></label>
      <label className="text-xs font-semibold sm:col-span-2">Role summary<textarea maxLength={10000} rows={5} value={draft.description} onChange={event => update("description", event.target.value)} placeholder="Paste or summarize the responsibilities and requirements you verified." className={input} /></label>
      {error && <p role="alert" className="text-xs text-destructive sm:col-span-2">{error}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Adding…" : "Add & match"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={close}>Cancel</Button></div>
    </form>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>;
}
