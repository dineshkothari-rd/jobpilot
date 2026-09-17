"use client";

import Link from "next/link";
import { Dialog } from "@base-ui/react/dialog";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { blankAnswer, buildQuestions, parseProgress, parseSetup, remainingSeconds, reviewSummary, topics, validId, type Mode, type PracticeAnswer, type PracticeSession, type Topic } from "@/lib/practice/model";
import { VoiceAnswer } from "./voice-answer";

type History = Pick<PracticeSession, "id" | "role" | "topic" | "mode" | "minutes" | "status" | "version" | "created_at" | "updated_at">;
type Context = { userId: string; targetRole: string; skills: string[]; jobs: { id: string; title: string; company_name: string }[]; sessions: History[]; storageReady: boolean };
const inputClass = "mt-2 min-h-11 w-full rounded-xl border bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-ring";
const keyFor = (owner: string, id: string) => `jobpilot:practice:v1:${owner}:${id}`;
const lastKey = (owner: string) => `jobpilot:practice:last:v1:${owner}`;
const payload = (s: PracticeSession) => ({ answers: s.answers, current_index: s.current_index, status: s.status });

async function api(body?: Record<string, unknown>, id?: string) {
  const response = await fetch(`/api/practice${id ? `?id=${encodeURIComponent(id)}` : ""}`, { cache: "no-store", ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(20000) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Practice request failed. Your draft is unchanged.");
  return result;
}

export function PracticeStudio({ initialJob = "", initialSession = "" }: { initialJob?: string; initialSession?: string }) {
  const [context, setContext] = useState<Context | null>(null);
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [role, setRole] = useState("");
  const [topic, setTopic] = useState<Topic>("role");
  const [mode, setMode] = useState<Mode>("mixed");
  const [minutes, setMinutes] = useState(20);
  const [jobId, setJobId] = useState(initialJob);
  const [jobLabel, setJobLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saved, setSaved] = useState("");
  const [draftWarning, setDraftWarning] = useState("");
  const [offline, setOffline] = useState(false);
  const [now, setNow] = useState(0);
  const [hintQuestion, setHintQuestion] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [preview, setPreview] = useState(false);
  const [parked, setParked] = useState<PracticeSession | null>(null);
  const pendingCreate = useRef<Record<string, unknown> | null>(null);
  const openedFromHome = useRef("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data: Context = await api(); setContext(data);
      if (data.targetRole) setRole(data.targetRole);
      try {
        const pointer = JSON.parse(sessionStorage.getItem(lastKey(data.userId)) || "null");
        if (pointer && validId(pointer.id)) {
          const draft = JSON.parse(sessionStorage.getItem(keyFor(data.userId, pointer.id)) || "null") as PracticeSession | null;
          if (draft && draft.id === pointer.id) {
            const setup = parseSetup({ ...draft, jobId: draft.job_id });
            const fresh = { ...draft, questions: buildQuestions(setup.topic, setup.role, setup.mode, setup.minutes, data.skills) };
            const restored = pointer.preview ? { ...fresh, ...parseProgress(payload(draft), fresh) } : fresh;
            setParked(restored); setPreview(Boolean(pointer.preview));
          }
        }
      } catch { /* A malformed or unavailable local draft does not block account history. */ }
      if (initialJob) {
        const response = await fetch(`/api/jobs/${encodeURIComponent(initialJob)}/interview`, { cache: "no-store", signal: AbortSignal.timeout(20000) });
        const result = await response.json();
        if (!response.ok) { setJobId(""); setNotice("This target job is unavailable. You can still practice a role."); }
        else { setJobLabel(`${result.job.title} · ${result.job.company_name}`); setRole(result.job.title.slice(0, 120)); }
      }
    } catch (e) { setError(e instanceof Error ? e.message : "Could not load practice."); }
  }, [initialJob]);
  useEffect(() => { const timer = setTimeout(() => void load(), 0); return () => clearTimeout(timer); }, [load]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine); update();
    window.addEventListener("online", update); window.addEventListener("offline", update);
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update); };
  }, []);
  const active = session?.status === "active";
  useEffect(() => {
    if (!active) return;
    const update = () => setNow(Date.now()); update();
    const timer = setInterval(update, 1000); return () => clearInterval(timer);
  }, [active]);
  const dirty = Boolean(session && JSON.stringify(payload(session)) !== saved);
  useEffect(() => {
    if (!session || !context || (!dirty && !preview)) return;
    try {
      sessionStorage.setItem(keyFor(context.userId, session.id), JSON.stringify({ id: session.id, role: session.role, topic: session.topic, mode: session.mode, minutes: session.minutes, job_id: session.job_id, version: session.version, created_at: session.created_at, updated_at: session.updated_at, ...payload(session) }));
      sessionStorage.setItem(lastKey(context.userId), JSON.stringify({ id: session.id, preview }));
    }
    catch {
      const timer = setTimeout(() => setDraftWarning("This browser could not keep a tab-local draft. Save to your account or copy your work before leaving."), 0);
      return () => clearTimeout(timer);
    }
  }, [session, context, dirty, preview]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const open = useCallback(async (id: string, latestOnly = false) => {
    setBusy(true); setError(""); setNotice("");
    try {
      const data = await api(undefined, id); const server: PracticeSession = data.session;
      if (latestOnly && context) { try { sessionStorage.removeItem(keyFor(context.userId, id)); } catch { /* No draft storage available. */ } }
      setSaved(JSON.stringify(payload(server))); setPreview(false);
      let restored = server;
      if (!latestOnly && context) {
        try {
          const text = sessionStorage.getItem(keyFor(context.userId, id));
          if (text) {
            const draft = JSON.parse(text) as PracticeSession;
            const progress = parseProgress(payload(draft), server);
            if (draft.version === server.version) { restored = { ...server, ...progress }; setNotice("Your tab-local draft was restored. Save to keep it in your account."); }
            else if (JSON.stringify(progress) !== JSON.stringify(payload(server))) { restored = { ...server, ...progress, version: draft.version }; setNotice("A draft from an older version was recovered. Copy it before loading the latest saved version; saving will not overwrite newer work."); }
          }
        } catch { setNotice("The saved session is ready. No valid tab-local draft could be restored."); }
      }
      setSession(restored);
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open session."); }
    finally { setBusy(false); }
  }, [context]);
  useEffect(() => {
    if (!context || !validId(initialSession) || openedFromHome.current === initialSession) return;
    const timer = setTimeout(() => {
      openedFromHome.current = initialSession;
      void open(initialSession);
    }, 0);
    return () => clearTimeout(timer);
  }, [context, initialSession, open]);
  const start = async (retry?: PracticeSession) => {
    if (!context || busy) return;
    setError(""); setNotice(""); setBusy(true);
    try {
      const setup = { role, topic, mode, minutes, jobId: jobId || null, ...(retry ? { role: retry.role, topic: retry.topic, mode: retry.mode, jobId: retry.job_id, retryId: retry.id } : {}) };
      if (!role.trim()) throw new Error("Enter a target role first.");
      let next: PracticeSession;
      if (!context.storageReady) {
        if (retry) throw new Error("Saved weak-area retries need account storage.");
        const stamp = new Date().toISOString();
        next = { id: crypto.randomUUID(), role: role.trim(), job_id: null, topic, mode, minutes, questions: buildQuestions(topic, role.trim(), mode, minutes, context.skills), answers: {}, current_index: 0, status: "active", version: 1, created_at: stamp, updated_at: stamp };
        setPreview(true); setNotice("Preview session: no account history is saved until storage is configured.");
      } else {
        // Keep the same operation ID when retrying creation after a network failure.
        const fingerprint = JSON.stringify(setup);
        if (!pendingCreate.current || pendingCreate.current.fingerprint !== fingerprint) pendingCreate.current = { action: "create", id: crypto.randomUUID(), ...setup, fingerprint };
        const data = await api(pendingCreate.current); next = data.session;
        pendingCreate.current = null; setPreview(false);
        setContext(c => c ? { ...c, sessions: [next, ...c.sessions.filter(s => s.id !== next.id)].slice(0, 100) } : c);
      }
      setSession(next); setParked(null); setSaved(JSON.stringify(payload(next)));
    } catch (e) { setError(e instanceof Error ? e.message : "Could not start practice."); }
    finally { setBusy(false); }
  };
  const change = (patch: Partial<PracticeAnswer>) => {
    if (!session || busy) return;
    const id = session.questions[session.current_index].id;
    setSession(s => s ? { ...s, answers: { ...s.answers, [id]: { ...(s.answers[id] || blankAnswer()), ...patch } } } : s);
  };
  const save = async (complete = false) => {
    if (!session || busy || preview) return;
    if (offline) { setError("You are offline. Your draft remains here; reconnect before saving."); return; }
    setBusy(true); setError("");
    try {
      const snapshot = { ...session, ...(complete ? { status: "complete" as const } : {}) };
      const data = await api({ action: "save", id: session.id, version: session.version, ...payload(snapshot) });
      const next: PracticeSession = data.session;
      if (context) { try { sessionStorage.removeItem(keyFor(context.userId, next.id)); sessionStorage.removeItem(lastKey(context.userId)); } catch { /* Account save succeeded independently of draft storage. */ } }
      setSession(next); setSaved(JSON.stringify(payload(next))); setNotice("Saved privately to your account.");
      setContext(c => c ? { ...c, sessions: [next, ...c.sessions.filter(s => s.id !== next.id)].slice(0, 100) } : c);
    } catch (e) { setError(e instanceof Error ? e.message : "Save failed. Your draft is unchanged."); }
    finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    setBusy(true); setError("");
    try {
      await api({ action: "delete", id });
      if (context) { try {
        sessionStorage.removeItem(keyFor(context.userId, id));
        const pointer = JSON.parse(sessionStorage.getItem(lastKey(context.userId)) || "null");
        if (pointer?.id === id) sessionStorage.removeItem(lastKey(context.userId));
      } catch { /* No draft storage available. */ } }
      setContext(c => c ? { ...c, sessions: c.sessions.filter(s => s.id !== id) } : c);
      if (session?.id === id) setSession(null);
      if (parked?.id === id) setParked(null);
      setDeleteId(""); setNotice("Practice session and its saved answers deleted.");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not delete session."); }
    finally { setBusy(false); }
  };

  const summary = session ? reviewSummary(session) : null;
  const seconds = session && now ? remainingSeconds(session.created_at, session.minutes, now) : session ? session.minutes * 60 : 0;
  const question = session?.questions[session.current_index];
  const questionKey = `${session?.id}:${question?.id}`;
  const showHints = hintQuestion === questionKey;
  const answer = question && session ? session.answers[question.id] || blankAnswer() : blankAnswer();
  return <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6 sm:py-9">
    {initialJob && <Link href={`/jobs/${encodeURIComponent(initialJob)}`} className="inline-block text-sm text-primary underline">Back to job</Link>}
    <header className="surface p-5 sm:p-7"><p className="section-label text-primary">Free · Private · No AI required</p><h1 className="mt-2 text-2xl font-bold sm:text-3xl">Interview Practice Studio</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">Practice a real response, review it honestly and work on what needs another attempt.</p></header>
    {error && <div role="alert" className="surface border-destructive/30 p-4 text-sm"><p>{error}</p>{!context && <Button className="mt-3" onClick={() => void load()}>Retry loading</Button>}</div>}
    {notice && <p role="status" className="rounded-xl border bg-primary/5 p-4 text-sm">{notice}</p>}
    {offline && <p role="status" className="rounded-xl border p-4 text-sm">Offline: keep practicing in this tab. Account saves require a connection.</p>}
    {draftWarning && <p role="alert" className="rounded-xl border p-4 text-sm">{draftWarning}</p>}
    {!context && !error && <p role="status" className="surface p-6">Loading your private practice space…</p>}
    {context && !context.storageReady && <p className="surface p-4 text-sm">Account storage setup is pending. An administrator must apply the interview practice migration and configure the existing server-only key. Free preview practice still works.</p>}
    {context && !session && <>
      {parked && <section className="surface p-5"><h2 className="font-bold">Continue your tab-local practice</h2><p className="mt-2 text-sm">{parked.role} · {preview ? "Preview only" : "Draft retained in this tab"}</p><Button className="mt-3" disabled={busy} onClick={() => preview ? setSession(parked) : void open(parked.id)}>Continue draft</Button></section>}
      <section className="surface p-5 sm:p-7"><h2 className="text-lg font-bold">Set up your practice</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">Your profile supplies a role suggestion. Select a job for job-skill context, or choose a topic yourself. This is practice—not an employer interview or hiring prediction.</p>
        <fieldset disabled={busy} className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-semibold">Target job<select className={inputClass} value={jobId} onChange={e => { setJobId(e.target.value); const job = context.jobs.find(j => j.id === e.target.value); if (job) setRole(job.title.slice(0,120)); }}><option value="">Practice a role instead</option>{initialJob && !context.jobs.some(j => j.id === initialJob) && jobLabel && <option value={initialJob}>{jobLabel}</option>}{context.jobs.map(j => <option key={j.id} value={j.id}>{j.title} · {j.company_name}</option>)}</select></label>
          <label className="text-sm font-semibold">Target role<input className={inputClass} maxLength={120} value={role} onChange={e => setRole(e.target.value)} /></label>
          <label className="text-sm font-semibold">Practice focus<select className={inputClass} value={topic} onChange={e => setTopic(e.target.value as Topic)}>{Object.entries(topics).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}</select></label>
          <label className="text-sm font-semibold">Practice mode<select className={inputClass} value={mode} onChange={e => setMode(e.target.value as Mode)}><option value="mixed">Mixed</option><option value="technical">Technical</option><option value="behavioral">Behavioral</option></select></label>
          <label className="text-sm font-semibold">Time guide<select className={inputClass} value={minutes} onChange={e => setMinutes(Number(e.target.value))}>{[10,20,30].map(n => <option key={n} value={n}>{n} minutes</option>)}</select></label>
        </fieldset>
        <p className="mt-4 text-xs leading-5 text-muted-foreground">Typed drafts are kept in this browser tab, scoped to your account. Save explicitly for durable history. Avoid confidential company details and personal secrets.</p>
        <Button className="mt-5" disabled={busy || !role.trim() || (offline && context.storageReady)} onClick={() => void start()}>{busy ? "Starting…" : context.storageReady ? "Start practice" : "Start free preview"}</Button>
      </section>
      <section className="surface p-5 sm:p-7"><h2 className="text-lg font-bold">Your practice history</h2><p className="mt-1 text-xs text-muted-foreground">{context.sessions.filter(s => s.status === "complete").length} completed · {context.sessions.filter(s => s.status === "active").length} resumable · Keep up to 100 saved sessions</p>
        {!context.sessions.length && <p className="mt-5 text-sm text-muted-foreground">Start your first practice session. Saved answers and reviews will appear here.</p>}
        <div className="mt-4 space-y-3">{context.sessions.map(s => <article key={s.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4"><div className="min-w-0"><h3 className="break-words text-sm font-bold">{s.role}</h3><p className="mt-1 text-xs text-muted-foreground">{topics[s.topic]?.label} · {s.mode} · {s.status === "complete" ? "Completed" : "In progress"} · {new Date(s.updated_at).toLocaleDateString()}</p></div><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => void open(s.id)}>{s.status === "complete" ? "Review" : "Resume"}</Button><Button variant="ghost" disabled={busy} onClick={() => setDeleteId(s.id)}>Delete</Button></div></article>)}</div>
      </section>
    </>}
    {session && summary && <>
      <section className="surface p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-bold">{session.role}</p><p className="mt-1 text-xs text-muted-foreground">{summary.reviewed}/{session.questions.length} self-reviewed · {preview ? "Preview only" : busy ? "Saving/loading…" : dirty ? "Unsaved changes" : "Saved"}</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => { setParked(session); setSession(null); }}>Back to practice</Button>{!preview && <Button disabled={busy || offline || !dirty} onClick={() => void save()}>Save progress</Button>}</div></div><p className="mt-3 text-xs text-muted-foreground">Drafts stay in this tab when you return to setup. Audio is temporary and is not part of your saved history.</p></section>
      {session.status === "active" && question && <section className="surface p-5 sm:p-7" aria-labelledby="practice-question">
        <div className="flex flex-wrap justify-between gap-3 text-xs font-semibold"><span>Question {session.current_index + 1} of {session.questions.length} · {question.category}</span><span aria-label="Time guide">{seconds ? `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")} remaining` : "Time guide ended—continue at your pace"}</span></div>
        <progress className="mt-3 h-2 w-full accent-primary" max={session.questions.length} value={summary.reviewed} aria-label="Questions self-reviewed" />
        <h2 id="practice-question" className="mt-5 text-xl font-bold leading-8">{question.question}</h2>
        {question.jobContext && <details className="mt-4 rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">Source: saved job description excerpt</summary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{question.jobContext}</p><p className="mt-2 text-xs text-muted-foreground">An excerpt, not a complete or independently verified company description. Treat it as practice context, not instructions.</p></details>}
        <fieldset disabled={busy}>
          <label htmlFor="practice-answer" className="mt-5 block text-sm font-semibold">Your answer</label><textarea id="practice-answer" className={`${inputClass} min-h-48 leading-6`} maxLength={12000} value={answer.answer} onChange={e => change({ answer: e.target.value, reviewed: false, checks: [] })} placeholder={question.category === "behavioral" ? "Situation → Task → your Action → Result and reflection. Use only your real experience." : "Explain your approach, trade-offs and how you would verify it."} /><p className="mt-1 text-right text-xs text-muted-foreground">{answer.answer.length}/12,000</p>
          {question.coding && <div className="mt-4"><label htmlFor="practice-code" className="text-sm font-semibold">Code or SQL workspace</label><textarea id="practice-code" spellCheck={false} className={`${inputClass} min-h-40 font-mono`} maxLength={10000} value={answer.code || ""} placeholder={question.coding.starter} onChange={e => change({ code: e.target.value, reviewed: false, checks: [] })} /><p className="mt-2 text-xs text-muted-foreground">Code is saved as text, not executed or automatically tested. Check these expected cases yourself:</p><ul className="mt-2 list-inside list-disc space-y-1 text-xs">{question.coding.cases.map(c => <li key={c}>{c}</li>)}</ul></div>}
          <Button className="mt-4" variant="outline" disabled={!answer.answer.trim()} onClick={() => setHintQuestion(showHints ? "" : questionKey)}>{showHints ? "Hide review guidance" : "Review my attempt"}</Button>
          {(showHints || answer.reviewed) && <div className="mt-4 rounded-xl border bg-muted/30 p-4"><h3 className="font-semibold">Honest self-review</h3><p className="mt-2 text-xs leading-5 text-muted-foreground">There is no automatic correctness grade. Check only criteria your answer actually demonstrates. Unchecked criteria become your retry topics.</p><p className="mt-3 text-xs leading-5">Answer outline: {question.whatToCover.join(" → ")}. Use your own examples; never invent a result.</p>{question.coding && <p className="mt-2 text-xs">Hints: {question.coding.hints.join(" ")}</p>}<div className="mt-4 space-y-3">{question.evaluationCriteria.map((criterion, i) => <label key={criterion} className="flex items-start gap-3 text-sm"><input type="checkbox" className="mt-1 size-4 shrink-0" checked={answer.checks[i] || false} onChange={e => { const checks = question.evaluationCriteria.map((_, j) => j === i ? e.target.checked : answer.checks[j] || false); change({ checks, reviewed: false }); }} /><span>{criterion}</span></label>)}</div><Button className="mt-4" disabled={!answer.answer.trim()} onClick={() => change({ checks: question.evaluationCriteria.map((_, i) => answer.checks[i] || false), reviewed: true })}>{answer.reviewed ? "Review recorded" : "Record self-review"}</Button></div>}
        </fieldset>
        <VoiceAnswer key={`${session.id}:${question.id}`} disabled={busy} onTranscript={text => setSession(s => {
          if (!s || busy) return s;
          const record = s.answers[question.id] || blankAnswer();
          return { ...s, answers: { ...s.answers, [question.id]: { ...record, answer: `${record.answer}${record.answer ? "\n" : ""}${text}`.slice(0,12000), reviewed: false, checks: [] } } };
        })} />
        <div className="mt-6 flex flex-wrap justify-between gap-3 border-t pt-5"><Button variant="outline" disabled={busy || session.current_index === 0} onClick={() => setSession(s => s ? { ...s, current_index: s.current_index - 1 } : s)}>Previous</Button>{session.current_index < session.questions.length - 1 ? <Button disabled={busy} onClick={() => setSession(s => s ? { ...s, current_index: s.current_index + 1 } : s)}>Next question</Button> : <Button disabled={busy || (offline && !preview) || summary.reviewed !== session.questions.length} onClick={() => preview ? setSession(s => s ? { ...s, status: "complete" } : s) : void save(true)}>Finish & review</Button>}</div>
        <p className="mt-3 text-xs text-muted-foreground">The timer never forces submission. Attempt and self-review every question before finishing.</p>
      </section>}
      {session.status === "complete" && <section className="surface p-5 sm:p-7"><h2 className="text-xl font-bold">Your practice review</h2><p className="mt-2 text-sm">You checked {summary.checked}/{summary.total} rubric items ({summary.percent}%). This is your self-assessment, not a correctness score or hiring prediction.</p><p className="mt-2 text-xs text-muted-foreground">{summary.weak.length ? `${summary.weak.length} questions need another attempt.` : "No weak criteria were reported. Try a new topic or challenge your answers with a peer."}</p>
        {summary.weak.length > 0 && !preview && <Button className="mt-4" disabled={busy || offline} onClick={() => void start(session)}>Retry weak questions</Button>}
        <div className="mt-5 space-y-3">{session.questions.map(q => <details key={q.id} className="rounded-xl border p-4"><summary className="cursor-pointer text-sm font-semibold">{q.question}</summary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{session.answers[q.id]?.answer}</p>{session.answers[q.id]?.code && <pre className="mt-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs">{session.answers[q.id].code}</pre>}<ul className="mt-4 space-y-2 text-xs">{q.evaluationCriteria.map((c, i) => <li key={c}>{session.answers[q.id]?.checks[i] ? "✓ Self-reported coverage" : "Needs practice"}: {c}</li>)}</ul>{summary.weak.some(w => w.id === q.id) && q.learningPath && <Link className="mt-4 inline-block text-sm text-primary underline" href={`/learn/${q.learningPath}`}>Review related learning path</Link>}</details>)}</div>
      </section>}
      {!preview && <details className="surface p-4"><summary className="cursor-pointer text-sm font-semibold">Draft recovery & privacy controls</summary><p className="mt-3 text-xs leading-5 text-muted-foreground">Before discarding a conflicting draft, copy your answer and code. Loading the saved version replaces this tab&apos;s draft.</p><Button className="mt-3" variant="outline" disabled={busy || offline} onClick={() => { if (window.confirm("Replace this tab's draft with the latest account version? Copy unsaved work first.")) void open(session.id, true); }}>Load latest saved version</Button></details>}
    </>}
    <Dialog.Root open={Boolean(deleteId)} onOpenChange={open => { if (!open && !busy) setDeleteId(""); }}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/30" /><Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-6 shadow-xl"><Dialog.Title className="font-bold">Delete this practice session?</Dialog.Title><Dialog.Description className="mt-2 text-sm">Its saved answers and reviews will be permanently removed.</Dialog.Description>{error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}<div className="mt-4 flex gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleteId("")}>Cancel</Button><Button variant="destructive" disabled={busy} onClick={() => void remove(deleteId)}>Confirm delete</Button></div></Dialog.Popup></Dialog.Portal></Dialog.Root>
    <footer className="flex flex-wrap gap-4 text-sm"><Link href="/learn" className={buttonVariants({ variant: "outline" })}>Learn & Certify</Link><Link href="/applications" className={buttonVariants({ variant: "outline" })}>Your applications</Link></footer>
  </div>;
}
