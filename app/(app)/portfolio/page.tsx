"use client";

import { Dialog } from "@base-ui/react/dialog";
import { CheckCircle2, Copy, ExternalLink, FolderKanban, Pencil, Plus, ShieldCheck, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { resumeProjectEvidence, type EvidenceInput } from "@/lib/portfolio/evidence";
import { safeExternalUrl } from "@/lib/utils";

type Evidence = EvidenceInput & {
  id: string;
  reviewed_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};
type Draft = Omit<EvidenceInput, "skills"> & { skills: string };

const emptyDraft: Draft = { title: "", problem: "", contribution: "", outcome: "", skills: "", evidence_url: "", source_kind: "manual", source_ref: null };
const input = "mt-1 min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm font-normal outline-none focus:ring-2 focus:ring-ring/40";

async function api(method = "GET", body?: unknown) {
  const response = await fetch("/api/portfolio", { method, headers: body ? { "Content-Type": "application/json" } : undefined, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(15000) });
  const value = await response.json().catch(() => null);
  if (!response.ok) throw new Error(value?.error || "Something went wrong. Please retry.");
  return value;
}

export default function PortfolioPage() {
  const [items, setItems] = useState<Evidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [editing, setEditing] = useState<Evidence | null | undefined>(undefined);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setItems((await api()).evidence || []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t load your evidence portfolio."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const updateItem = (item: Evidence) => setItems(current => current.map(row => row.id === item.id ? item : row).sort((a, b) => Date.parse(b.updated_at) - Date.parse(a.updated_at)));
  const review = async (item: Evidence) => {
    setBusyId(item.id); setError(""); setMessage("");
    try { updateItem((await api("PATCH", { id: item.id, version: item.version, action: "review" })).evidence); setMessage(`Reviewed “${item.title}”. It is ready for your final resume decision.`); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t review this evidence."); }
    finally { setBusyId(""); }
  };
  const remove = async (item: Evidence) => {
    if (!window.confirm(`Delete “${item.title}” from your private evidence portfolio? This cannot be undone.`)) return;
    setBusyId(item.id); setError(""); setMessage("");
    try { await api("DELETE", { id: item.id, version: item.version }); setItems(current => current.filter(row => row.id !== item.id)); setMessage("Evidence deleted."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t delete this evidence."); }
    finally { setBusyId(""); }
  };
  const copy = async (item: Evidence) => {
    try { await navigator.clipboard.writeText(resumeProjectEvidence(item)); setMessage(`Reviewed evidence for “${item.title}” copied. Paste it into Resume and keep only accurate claims.`); setError(""); }
    catch { setError("Clipboard access is unavailable. Copy the contribution and outcome manually."); }
  };

  return <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
    <header className="surface ai-surface p-5 sm:p-7">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="section-label">Evidence portfolio · Private by default</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Show what you actually did.</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Save original projects, your exact contribution and the result. Review every claim before reusing it in a resume or sharing it.</p></div>
        <Button onClick={() => setEditing(null)}><Plus />Add evidence</Button>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <Stat label="Saved evidence" value={items.length} />
        <Stat label="Reviewed" value={items.filter(item => item.reviewed_at).length} />
        <Stat label="Private records" value={items.length} />
      </div>
    </header>

    <p className="mt-4 rounded-xl border bg-muted/30 p-4 text-xs leading-5 text-muted-foreground"><ShieldCheck className="mr-2 inline size-4 text-emerald-600" />Nothing is public automatically. Parth Careers does not open, verify or publish your evidence URL. Copying reviewed text is an explicit sharing action.</p>
    {error ? <div role="alert" className="mt-4 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm text-destructive">{error}{!loading && items.length === 0 ? <Button variant="outline" size="sm" className="mt-3" onClick={() => void load()}>Retry loading</Button> : null}</div> : null}
    {message ? <p role="status" className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-4 text-sm">{message}</p> : null}

    <section className="mt-6" aria-labelledby="evidence-list-title">
      <div className="flex items-center justify-between gap-3"><div><p className="section-label">Your work</p><h2 id="evidence-list-title" className="mt-1 text-xl font-bold">Evidence you control</h2></div>{items.some(item => item.reviewed_at) ? <Link href="/resume" className={buttonVariants({ variant: "outline" })}>Open Resume</Link> : null}</div>
      {loading ? <p role="status" className="surface mt-4 p-5 text-sm">Loading your private evidence…</p> : items.length === 0 ? error ? null : <div className="surface mt-4 p-8 text-center"><FolderKanban className="mx-auto size-8 text-primary" /><h3 className="mt-3 font-bold">Start with one real project</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">A work sample, case study, volunteer project or original learning project is enough. Record only what you personally did.</p><Button className="mt-4" onClick={() => setEditing(null)}><Plus />Add your first evidence</Button></div> : <div className="mt-4 grid gap-4 lg:grid-cols-2">{items.map(item => <EvidenceCard key={item.id} item={item} busy={busyId === item.id} onEdit={() => setEditing(item)} onReview={() => void review(item)} onCopy={() => void copy(item)} onDelete={() => void remove(item)} />)}</div>}
    </section>
    {editing !== undefined ? <EvidenceDialog evidence={editing} onClose={() => setEditing(undefined)} onSaved={item => { if (editing) updateItem(item); else setItems(current => [item, ...current]); setEditing(undefined); setMessage(editing ? "Evidence updated. Review it again before resume reuse." : "Evidence saved privately. Review it when every claim is accurate."); }} /> : null}
  </div>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border bg-background/70 p-4"><p className="text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-muted-foreground">{label}</p></div>;
}

function EvidenceCard({ item, busy, onEdit, onReview, onCopy, onDelete }: { item: Evidence; busy: boolean; onEdit: () => void; onReview: () => void; onCopy: () => void; onDelete: () => void }) {
  const url = safeExternalUrl(item.evidence_url);
  return <article className="surface flex flex-col p-5">
    <div className="flex items-start justify-between gap-3"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold ${item.reviewed_at ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "bg-amber-500/10 text-amber-700 dark:text-amber-300"}`}>{item.reviewed_at ? "Reviewed" : "Needs review"}</span><h3 className="mt-3 text-lg font-bold">{item.title}</h3></div><Button variant="ghost" size="icon-sm" onClick={onEdit} disabled={busy} aria-label={`Edit ${item.title}`}><Pencil /></Button></div>
    {item.problem ? <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Problem</p><p className="mt-1 text-sm leading-6">{item.problem}</p></div> : null}
    <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">My contribution</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.contribution}</p></div>
    {item.outcome ? <div className="mt-4"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Outcome</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6">{item.outcome}</p></div> : null}
    {item.skills.length ? <div className="mt-4 flex flex-wrap gap-2">{item.skills.map(skill => <span key={skill} className="rounded-lg border bg-muted/30 px-2.5 py-1 text-xs font-semibold">{skill}</span>)}</div> : null}
    <div className="mt-auto flex flex-wrap gap-2 pt-5">
      {!item.reviewed_at ? <Button size="sm" onClick={onReview} disabled={busy}><CheckCircle2 />I reviewed every claim</Button> : <Button size="sm" onClick={onCopy} disabled={busy}><Copy />Copy for Resume</Button>}
      {url ? <a href={url} target="_blank" rel="noopener noreferrer" className={buttonVariants({ variant: "outline", size: "sm" })}>Open evidence<ExternalLink /></a> : null}
      <Button variant="ghost" size="sm" onClick={onDelete} disabled={busy} className="text-destructive"><Trash2 />Delete</Button>
    </div>
  </article>;
}

function EvidenceDialog({ evidence, onClose, onSaved }: { evidence: Evidence | null; onClose: () => void; onSaved: (item: Evidence) => void }) {
  const [draft, setDraft] = useState<Draft>(() => evidence ? { title: evidence.title, problem: evidence.problem, contribution: evidence.contribution, outcome: evidence.outcome, skills: evidence.skills.join(", "), evidence_url: evidence.evidence_url, source_kind: evidence.source_kind, source_ref: evidence.source_ref } : emptyDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const changed = JSON.stringify(draft) !== JSON.stringify(evidence ? { title: evidence.title, problem: evidence.problem, contribution: evidence.contribution, outcome: evidence.outcome, skills: evidence.skills.join(", "), evidence_url: evidence.evidence_url, source_kind: evidence.source_kind, source_ref: evidence.source_ref } : emptyDraft);
  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [changed]);
  const close = () => { if (busy || (changed && !window.confirm("Discard this evidence draft?"))) return; onClose(); };
  const save = async () => {
    if (busy) return;
    setBusy(true); setError("");
    const value = { title: draft.title, problem: draft.problem, contribution: draft.contribution, outcome: draft.outcome, skills: draft.skills.split(",").map(skill => skill.trim()).filter(Boolean), evidence_url: draft.evidence_url };
    try { onSaved((await api(evidence ? "PATCH" : "POST", evidence ? { id: evidence.id, version: evidence.version, ...value } : { ...value, source_kind: "manual", source_ref: null })).evidence); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "We couldn’t save this evidence."); }
    finally { setBusy(false); }
  };
  const change = (key: keyof Draft, value: string) => setDraft(current => ({ ...current, [key]: value }));
  return <Dialog.Root open onOpenChange={open => { if (!open) close(); }}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-[60] bg-foreground/35 backdrop-blur-sm" /><Dialog.Popup className="fixed inset-x-0 bottom-0 z-[61] max-h-[92dvh] overflow-y-auto rounded-t-3xl border bg-background p-5 shadow-2xl sm:left-1/2 sm:top-1/2 sm:bottom-auto sm:w-[min(700px,calc(100%-2rem))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl">
    <div className="flex items-start justify-between gap-3"><div><Dialog.Title className="text-lg font-bold">{evidence ? "Edit evidence" : "Add project evidence"}</Dialog.Title><Dialog.Description className="mt-1 text-xs leading-5 text-muted-foreground">Use your own words. Editing reviewed evidence resets its review status.</Dialog.Description></div><Button variant="ghost" size="icon-sm" disabled={busy} onClick={close} aria-label="Close evidence form"><X /></Button></div>
    <form className="mt-5 grid gap-4 sm:grid-cols-2" onSubmit={event => { event.preventDefault(); void save(); }}>
      <label className="text-xs font-semibold sm:col-span-2">Project or work-sample title<input required maxLength={180} value={draft.title} onChange={event => change("title", event.target.value)} className={input} /></label>
      <label className="text-xs font-semibold sm:col-span-2">Problem or goal<textarea rows={3} maxLength={2000} value={draft.problem} onChange={event => change("problem", event.target.value)} className={input} placeholder="What needed to improve or be created?" /></label>
      <label className="text-xs font-semibold sm:col-span-2">What I personally contributed<textarea required minLength={20} rows={5} maxLength={5000} value={draft.contribution} onChange={event => change("contribution", event.target.value)} className={input} placeholder="Be precise about your decisions, actions and ownership." /></label>
      <label className="text-xs font-semibold sm:col-span-2">Outcome or checks<textarea rows={3} maxLength={2000} value={draft.outcome} onChange={event => change("outcome", event.target.value)} className={input} placeholder="Use a measured result only when you can support it." /></label>
      <label className="text-xs font-semibold">Skills used<input maxLength={3000} value={draft.skills} onChange={event => change("skills", event.target.value)} className={input} placeholder="Recruiting, Excel, React…" /><span className="mt-1 block font-normal text-muted-foreground">Up to 30 unique comma-separated skills.</span></label>
      <label className="text-xs font-semibold">Evidence URL, optional<input type="url" maxLength={2000} value={draft.evidence_url} onChange={event => change("evidence_url", event.target.value)} className={input} placeholder="https://…" /><span className="mt-1 block font-normal text-muted-foreground">Public HTTPS only. Do not link secrets or private client data.</span></label>
      {error ? <p role="alert" className="text-xs text-destructive sm:col-span-2">{error}</p> : null}
      <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="submit" disabled={busy}>{busy ? "Saving…" : evidence ? "Save changes" : "Save privately"}</Button><Button type="button" variant="ghost" disabled={busy} onClick={close}>Cancel</Button></div>
    </form>
  </Dialog.Popup></Dialog.Portal></Dialog.Root>;
}
