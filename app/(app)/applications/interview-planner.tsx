"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarClock, Download, Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { interviewCalendar, localInterviewTime, parseInterview, type Interview } from "@/lib/applications/interviews";

type Draft = Omit<Interview, "starts_at"> & { local_time: string };
const input = "min-h-11 w-full min-w-0 rounded-xl border bg-background px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-ring";

export function InterviewPlanner({ applicationId, jobId, title, onDirty }: {
  applicationId: string; jobId: string; title: string; onDirty: (dirty: boolean) => void;
}) {
  const [events, setEvents] = useState<Interview[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const lock = useRef(false);

  useEffect(() => {
    if (!draft) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    const leave = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (link && !link.getAttribute("href")?.startsWith("#") && !window.confirm("Leave and discard your unsaved interview draft?")) { event.preventDefault(); event.stopPropagation(); }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", leave, true);
    return () => { window.removeEventListener("beforeunload", warn); document.removeEventListener("click", leave, true); };
  }, [draft]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`/api/interviews?application=${applicationId}`, { cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        const data = await response.json();
        if (!response.ok || !Array.isArray(data.interviews)) throw new Error(data.error || "Your rounds couldn’t be loaded.");
        setEvents(data.interviews); setReady(true);
      } catch (e) { if (!controller.signal.aborted) setError(e instanceof Error ? e.message : "Your rounds couldn’t be loaded."); }
    }, 0);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [applicationId]);

  const reload = async () => {
    if (draft && !window.confirm("Discard this draft and reload your saved rounds?")) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/interviews?application=${applicationId}`, { cache: "no-store", signal: AbortSignal.timeout(10000) });
      const data = await response.json();
      if (!response.ok || !Array.isArray(data.interviews)) throw new Error(data.error || "Your rounds couldn’t be loaded.");
      setEvents(data.interviews); setReady(true); setDraft(null); onDirty(false); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Please retry."); }
    finally { setBusy(false); }
  };
  const edit = (event?: Interview) => {
    if (draft && !window.confirm("Discard this draft before opening another round?")) return;
    if (event) {
      const { starts_at, ...value } = event;
      setDraft({ ...value, local_time: localInterviewTime(starts_at, event.timezone) });
    } else setDraft({
      id: crypto.randomUUID(), application_id: applicationId, round: "", local_time: "", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      duration_minutes: 60, location: "", notes: "", status: "scheduled", outcome: "", version: 0,
    });
    onDirty(true); setNotice(""); setError("");
  };
  const save = async () => {
    if (!draft || lock.current) return;
    lock.current = true; setBusy(true); setError(""); setNotice("");
    try {
      parseInterview(draft);
      const response = await fetch("/api/interviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft), signal: AbortSignal.timeout(15000) });
      const data = await response.json();
      if (!response.ok || !data.interview) throw new Error(data.error || "Your round couldn’t be saved. Reload to check before retrying.");
      setEvents(current => [...current.filter(event => event.id !== data.interview.id), data.interview].sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)));
      setDraft(null); onDirty(false); setNotice("Round saved. You’re ready to plan your preparation.");
    } catch (e) { setError(e instanceof Error ? e.message : "Your draft is still here. Retry shortly."); }
    finally { lock.current = false; setBusy(false); }
  };
  const download = (event: Interview) => {
    const url = URL.createObjectURL(new Blob([interviewCalendar(event, title)], { type: "text/calendar;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = `interview-${event.id}.ics`; anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const change = (value: Partial<Draft>) => { setDraft(current => current ? { ...current, ...value } : null); onDirty(true); };

  return <section className="mt-5 rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-sky-500/5 p-4" aria-label="Interview planner">
    <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-bold"><CalendarClock className="size-4 text-primary" />Your interviews</h3><Button variant="outline" size="sm" disabled={!ready || busy} onClick={() => edit()}><Plus />Add round</Button></div>
    <p className="mt-2 text-xs leading-5 text-muted-foreground">Keep each round, preparation notes and next steps together. Scheduling doesn’t change your application status.</p>
    {error && <div className="mt-3"><p role="alert" className="text-xs text-destructive">{error}</p><Button variant="outline" className="mt-2" disabled={busy} onClick={() => void reload()}>Reload saved rounds</Button></div>}
    {notice && <p role="status" className="mt-3 text-xs text-emerald-700 dark:text-emerald-300">{notice}</p>}
    {!ready && !error && <p role="status" className="mt-3 text-xs">Loading your rounds…</p>}
    {ready && !events.length && !draft && <p className="mt-4 rounded-xl border border-dashed p-4 text-xs text-muted-foreground">Got an interview invite? Add the confirmed time and round to get started.</p>}
    <div className="mt-3 space-y-3">{events.map(event => <article key={event.id} className="rounded-xl border bg-background/80 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">{event.round}</h4><span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-semibold capitalize text-primary">{event.status}</span></div>
      <p className="mt-1 break-words text-xs text-muted-foreground">{localInterviewTime(event.starts_at, event.timezone).replace("T", " · ")} · {event.timezone} · {event.duration_minutes} min</p>
      {event.location && <p className="mt-2 break-words text-xs">Where: {event.location}</p>}
      {event.notes && <p className="mt-2 whitespace-pre-wrap break-words text-xs text-muted-foreground">{event.notes}</p>}
      {event.outcome && <p className="mt-2 whitespace-pre-wrap break-words text-xs">Next steps: {event.outcome}</p>}
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={busy} onClick={() => edit(event)}>Edit round</Button><Button variant="ghost" size="sm" onClick={() => download(event)}><Download />Calendar</Button></div>
    </article>)}</div>
    {draft && <form className="mt-4 space-y-3 rounded-xl border bg-background p-3" onSubmit={e => { e.preventDefault(); void save(); }}>
      <h4 className="text-sm font-bold">{draft.version ? "Update this round" : "Plan a new round"}</h4>
      <fieldset disabled={busy} className="space-y-3">
        <label className="block text-xs font-medium">Round name<input required maxLength={120} value={draft.round} onChange={e => change({ round: e.target.value })} placeholder="Recruiter chat, portfolio review…" className={`${input} mt-1`} /></label>
        <label className="block text-xs font-medium">Date & time<input required type="datetime-local" value={draft.local_time} onChange={e => change({ local_time: e.target.value })} className={`${input} mt-1`} /></label>
        <label className="block text-xs font-medium">Timezone<input required maxLength={100} value={draft.timezone} onChange={e => change({ timezone: e.target.value })} placeholder="Asia/Kolkata" className={`${input} mt-1`} /><span className="mt-1 block font-normal text-muted-foreground">Time above is in this timezone. Changing the zone keeps the entered clock time—check it against your invite.</span></label>
        <label className="block text-xs font-medium">Duration (minutes)<input required type="number" min={5} max={480} step={1} value={draft.duration_minutes} onChange={e => change({ duration_minutes: Number(e.target.value) })} className={`${input} mt-1`} /></label>
        <label className="block text-xs font-medium">Meeting link or venue<input maxLength={1000} value={draft.location} onChange={e => change({ location: e.target.value })} className={`${input} mt-1`} /></label>
        <label className="block text-xs font-medium">Preparation notes<textarea maxLength={5000} rows={3} value={draft.notes} onChange={e => change({ notes: e.target.value })} className={`${input} mt-1`} /></label>
        <label className="block text-xs font-medium">Round status<select value={draft.status} onChange={e => change({ status: e.target.value as Interview["status"] })} className={`${input} mt-1`}><option value="scheduled">Scheduled</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></label>
        <label className="block text-xs font-medium">Outcome & next steps<textarea maxLength={2000} rows={2} value={draft.outcome} onChange={e => change({ outcome: e.target.value })} placeholder="Feedback, next round, what to follow up on…" className={`${input} mt-1`} /></label>
      </fieldset>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save round"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={() => { if (window.confirm("Discard this unsaved round draft?")) { setDraft(null); onDirty(false); } }}>Discard draft</Button></div>
    </form>}
    <div className="mt-4 flex flex-wrap gap-2"><Link href={`/practice?job=${encodeURIComponent(jobId)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>Practice for this role</Link><Link href={`/jobs/${encodeURIComponent(jobId)}/prepare`} className={buttonVariants({ variant: "outline", size: "sm" })}>Review job requirements</Link><Link href="/learn" className={buttonVariants({ variant: "ghost", size: "sm" })}>Find a learning path</Link></div>
    <p className="mt-3 text-[11px] leading-5 text-muted-foreground">Calendar downloads contain your notes and venue. Import into your calendar and set reminders there. JobPilot doesn’t send interview notifications or sync later edits automatically.</p>
  </section>;
}
