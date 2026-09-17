"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Bookmark, ExternalLink, Play, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { LearningPath } from "@/lib/learning/catalog";
import { certificateEligible, initialEnrollment, resumeEvidence, type Enrollment } from "@/lib/learning/model";
import { CredentialList, learningMutation, useLearningData, useUnsavedLearning, type MutationResult } from "../learning-client";

export function LearningWorkspace({ path }: { path: LearningPath }) {
  const { data, setData, error, setError, retry } = useLearningData(path.id);
  const stored = data?.enrollments.find((item) => item.path_id === path.id);
  const [draft, setDraft] = useState<Enrollment | null>(null);
  const enrollment = draft || stored || initialEnrollment(path);
  const started = Boolean(stored);
  const dirty = Boolean(draft && stored && JSON.stringify(draft) !== JSON.stringify(stored));
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [feedback, setFeedback] = useState("");
  const [videoFor, setVideoFor] = useState<string | null>(null);
  const [answers, setAnswers] = useState<number[]>([]);
  const attemptId = useRef<string | null>(null);
  const [grade, setGrade] = useState<MutationResult | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const selected = path.lessons.find((lesson) => lesson.id === enrollment.selected_lesson) || path.lessons[0];
  const currentIndex = path.lessons.indexOf(selected);
  const bestScore = Math.max(0, ...(data?.attempts.filter((attempt) => attempt.path_id === path.id).map((attempt) => attempt.score) || []));
  const eligible = started && !dirty && certificateEligible(path, enrollment, bestScore);
  const credential = data?.credentials.find((item) => item.path_id === path.id && item.kind === "jobpilot");
  const remainingMinutes = path.lessons.filter((lesson) => !enrollment.completed.includes(lesson.id)).reduce((sum, lesson) => sum + lesson.minutes, 0);

  useUnsavedLearning(dirty);
  const edit = (value: Partial<Enrollment>) => { setDraft({ ...enrollment, ...value }); setConfirmed(false); setFeedback(""); };
  const mutate = async (body: Record<string, unknown>) => {
    if (lock.current || !data?.storageReady) return null;
    lock.current = true; setBusy(true); setError(""); setFeedback("");
    try {
      const result = await learningMutation(body);
      if (result.enrollment) {
        const saved = result.enrollment;
        setData((current) => current ? { ...current, enrollments: [saved, ...current.enrollments.filter((item) => item.path_id !== saved.path_id)] } : current);
        setDraft(null); setConfirmed(false);
      }
      if (result.attempt) {
        const saved = result.attempt;
        setData((current) => current ? { ...current, attempts: [saved, ...current.attempts.filter((item) => item.id !== saved.id)] } : current);
        setGrade(result); attemptId.current = null;
      }
      if (result.credential) {
        const saved = result.credential;
        setData((current) => current ? { ...current, credentials: [saved, ...current.credentials.filter((item) => item.id !== saved.id)] } : current);
        setConfirmed(false);
      }
      setFeedback(body.action === "save" ? "Saved. Your notes, exercises and next lesson are available when you return." : body.action === "enroll" ? "Path started. Choose a lesson and learn at your pace." : body.action === "assess" ? "Knowledge check saved. Review the explanations below." : "Completion record updated.");
      return result;
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save learning."); return null; }
    finally { lock.current = false; setBusy(false); }
  };
  const save = () => {
    const { completed, bookmarks, notes, selected_lesson, minutes_per_day, target_role, project_url, project_summary } = enrollment;
    return mutate({ action: "save", pathId: path.id, version: enrollment.version, progress: { completed, bookmarks, notes, selected_lesson, minutes_per_day, target_role, project_url, project_summary } });
  };
  const canEdit = started && Boolean(data?.storageReady) && !busy;
  const selectLesson = (id: string) => { edit({ selected_lesson: id }); setVideoFor(null); };

  return <div className="mx-auto max-w-7xl p-4 sm:p-6 lg:p-8">
    <Link href="/learn" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"><ArrowLeft className="size-4" />Learn & Certify</Link>
    <header className="surface ai-surface mt-3 p-5 sm:p-7"><p className="section-label">{path.level} · Free learning · English</p><h1 className="mt-2 text-3xl font-bold tracking-tight">{path.title}</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{path.description}</p><p className="mt-3 text-sm leading-6"><span className="font-semibold">Before you begin: </span>{path.prerequisites}</p>
      {!started ? <Button className="mt-4" disabled={busy || !data?.storageReady} onClick={() => void mutate({ action: "enroll", pathId: path.id })}>{busy ? "Starting…" : "Start this free path"}</Button> : <div className="mt-4"><p className="text-sm font-semibold">{enrollment.completed.length}/{path.lessons.length} exercises marked complete · Best knowledge check {bestScore}%</p><progress value={enrollment.completed.length} max={path.lessons.length} aria-label="Self-reported exercise progress" className="mt-3 h-2 w-full accent-primary" /><p className="mt-2 text-xs text-muted-foreground">Estimated {Math.ceil(remainingMinutes / enrollment.minutes_per_day)} study days remaining, excluding the capstone. Estimates are JobPilot planning guides, not provider durations.</p></div>}
    </header>
    {!data && !error ? <p role="status" className="mt-4 text-sm">Loading saved learning… Resources remain available below.</p> : null}
    {data && !data.storageReady ? <p role="status" className="surface mt-4 p-4 text-sm leading-6">{data.setupMessage} Preview lessons without saving below.</p> : null}
    {error ? <div role="alert" className="surface mt-4 p-4 text-sm"><p>{error}</p><Button variant="outline" size="sm" className="mt-3" onClick={() => { if (dirty && !window.confirm("Keep a copy of unsaved edits before refreshing. Discard and reload saved progress?")) return; setDraft(null); retry(); }}>Reload saved data</Button></div> : null}
    <p role="status" className="my-4 text-sm leading-6">{feedback}</p>
    <div className="grid items-start gap-5 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="surface p-4"><h2 className="font-bold">Your curriculum</h2><nav aria-label="Path lessons" className="mt-3 space-y-2">{path.lessons.map((lesson, index) => <button key={lesson.id} type="button" aria-current={selected.id === lesson.id ? "step" : undefined} disabled={busy} onClick={() => selectLesson(lesson.id)} className={`flex min-h-12 w-full items-start gap-2 rounded-xl border p-3 text-left text-sm ${selected.id === lesson.id ? "border-primary/30 bg-primary/10 text-primary" : "hover:bg-muted"}`}><span className="shrink-0">{enrollment.completed.includes(lesson.id) ? <Check className="mt-0.5 size-4" aria-label="Exercise marked complete" /> : index + 1}</span><span>{lesson.title}</span></button>)}</nav><p className="mt-4 text-xs leading-5 text-muted-foreground">Completion is your confirmation of an exercise—not a claim that a video was watched or a provider course was passed.</p></aside>
      <div className="min-w-0 space-y-5">
        <section className="surface p-5"><p className="section-label">Lesson {currentIndex + 1} · {selected.format} · {selected.provider}</p><h2 className="mt-2 text-xl font-bold">{selected.title}</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">{selected.access}</p>
          <div className="mt-4 flex flex-wrap gap-3"><a href={selected.url} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground">Open free lesson<ExternalLink className="size-4" /></a>{selected.embedUrl ? <Button variant="outline" onClick={() => setVideoFor(videoFor === selected.id ? null : selected.id)}><Play className="size-4" />{videoFor === selected.id ? "Close player" : "Watch here"}</Button> : null}<Button variant="outline" disabled={!canEdit} onClick={() => edit({ bookmarks: enrollment.bookmarks.includes(selected.id) ? enrollment.bookmarks.filter((id) => id !== selected.id) : [...enrollment.bookmarks, selected.id] })}><Bookmark className="size-4" />{enrollment.bookmarks.includes(selected.id) ? "Bookmarked" : "Bookmark"}</Button></div>
          {selected.embedUrl && videoFor === selected.id ? <div className="mt-4"><iframe key={selected.id} src={selected.embedUrl} title={selected.title} className="aspect-video w-full rounded-xl border" allow="encrypted-media; picture-in-picture; fullscreen" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" /><p className="mt-2 text-xs leading-5 text-muted-foreground">YouTube loads only after you choose Watch here and may receive playback data. Creator controls remain unchanged. If playback is blocked, use Open free lesson. No viewing/completion tracking.</p></div> : null}
          <details className="mt-4 text-xs leading-6 text-muted-foreground"><summary className="cursor-pointer font-semibold">Source, free access and fallback</summary><p className="mt-2">Verified {selected.verifiedOn}. Resource remains with {selected.provider}; not downloaded, copied or rehosted. Free-to-view does not imply an open-source licence.</p><a href={selected.alternative} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center text-primary underline">Try the free alternative/reference</a><p>If a provider now asks for payment or a trial, stop and use the alternative. Access can change; this is a dated manual check, not a live pricing guarantee.</p></details>
          <div className="mt-5 rounded-xl border bg-muted/30 p-4"><h3 className="font-bold">Build something small</h3><p className="mt-2 text-sm leading-6">{selected.task}</p><label className="mt-4 flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" checked={enrollment.completed.includes(selected.id)} disabled={!canEdit} onChange={(event) => edit({ completed: event.target.checked ? [...enrollment.completed, selected.id] : enrollment.completed.filter((id) => id !== selected.id) })} className="mt-1" />I completed this exercise and can explain my work.</label></div>
          <label className="mt-5 block text-sm font-semibold">Private lesson notes<textarea maxLength={2000} rows={4} value={enrollment.notes[selected.id] || ""} disabled={!canEdit} onChange={(event) => edit({ notes: { ...enrollment.notes, [selected.id]: event.target.value } })} className="mt-2 w-full rounded-xl border bg-background p-3 font-normal" placeholder="What did you learn? What should you revisit?" /></label>
          <div className="mt-4 flex flex-wrap gap-3"><Button disabled={!canEdit || !dirty} onClick={() => void save()}><Save className="size-4" />{busy ? "Saving…" : "Save learning"}</Button><Button variant="outline" disabled={busy || currentIndex === path.lessons.length - 1} onClick={() => selectLesson(path.lessons[currentIndex + 1].id)}>Next lesson</Button>{dirty ? <Button variant="outline" disabled={busy} onClick={() => { if (window.confirm("Discard unsaved notes, project and progress changes?")) { setDraft(null); setConfirmed(false); } }}>Discard edits</Button> : null}</div>
        </section>
        {started ? <details className="surface p-5"><summary className="cursor-pointer font-bold">Adjust your study plan</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold">Minutes per day<input type="number" min={10} max={180} value={enrollment.minutes_per_day} disabled={!canEdit} onChange={(event) => edit({ minutes_per_day: Number(event.target.value) })} className="mt-2 h-11 w-full rounded-lg border bg-background px-3" /></label><label className="text-sm font-semibold">Learning target (optional)<input maxLength={120} value={enrollment.target_role} disabled={!canEdit} onChange={(event) => edit({ target_role: event.target.value })} className="mt-2 h-11 w-full rounded-lg border bg-background px-3" placeholder={data?.targetRole || "Your learning goal"} /></label></div><p className="mt-3 text-xs text-muted-foreground">Save learning to update this plan. This does not change your Profile target role.</p></details> : null}
        <section className="surface p-5"><p className="section-label">Prove what you learned</p><h2 className="mt-2 text-xl font-bold">Your original capstone</h2><p className="mt-3 text-sm leading-6">{path.project}</p><p className="mt-3 text-xs leading-5 text-muted-foreground">Self-reported evidence, not an automatically graded or provider-approved project. JobPilot does not fetch your URL or run your code. Use only work you can share; avoid personal data and secrets.</p>
          <label className="mt-4 block text-sm font-semibold">Repository or demo URL<input type="url" maxLength={2000} value={enrollment.project_url} disabled={!canEdit} onChange={(event) => edit({ project_url: event.target.value })} className="mt-2 h-11 w-full rounded-lg border bg-background px-3" placeholder="https://github.com/you/project" /></label><label className="mt-4 block text-sm font-semibold">Your contribution and checks (at least 50 characters)<textarea rows={4} maxLength={2000} value={enrollment.project_summary} disabled={!canEdit} onChange={(event) => edit({ project_summary: event.target.value })} className="mt-2 w-full rounded-xl border bg-background p-3 font-normal" /></label>
          <div className="mt-4 flex flex-wrap gap-3"><Button disabled={!canEdit || !dirty} onClick={() => void save()}>Save project & learning</Button><Button variant="outline" disabled={!enrollment.project_url || !enrollment.project_summary} onClick={async () => { try { await navigator.clipboard.writeText(resumeEvidence(enrollment, path)); setFeedback("Evidence copied. Review its accuracy before adding it in Resume Studio; no resume was changed."); } catch { setFeedback("Clipboard unavailable. Select and copy your project explanation manually."); } }}>Copy factual resume evidence</Button><Link href="/resume/studio" className="inline-flex min-h-11 items-center text-sm text-primary underline">Review in Resume Studio</Link></div>
        </section>
        <section className="surface p-5"><p className="section-label">Original JobPilot knowledge check</p><h2 className="mt-2 text-xl font-bold">Check your understanding</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">Three original questions, at least two correct to pass. This is a short learning checkpoint, not a professional certification exam. Up to 20 attempts per path in 24 hours.</p>
          {data?.questions.length ? <form className="mt-4 space-y-5" onSubmit={(event) => { event.preventDefault(); attemptId.current ||= crypto.randomUUID(); void mutate({ action: "assess", pathId: path.id, answers, requestId: attemptId.current }); }}>
            {data.questions.map((question, index) => <fieldset key={question.prompt} disabled={!canEdit}><legend className="text-sm font-semibold">{index + 1}. {question.prompt}</legend><div className="mt-2 space-y-1">{question.options.map((option, optionIndex) => <label key={option} className="flex min-h-11 items-center gap-2 rounded-lg border p-3 text-sm"><input type="radio" name={`question-${index}`} required checked={answers[index] === optionIndex} onChange={() => { attemptId.current = null; setGrade(null); setAnswers((current) => { const next = [...current]; next[index] = optionIndex; return next; }); }} />{option}</label>)}</div></fieldset>)}
            <Button type="submit" disabled={!canEdit || answers.length !== data.questions.length || data.questions.some((_, index) => !Number.isInteger(answers[index]))}>{busy ? "Saving…" : "Check answers"}</Button>
          </form> : <p className="mt-4 text-sm text-muted-foreground">Start the path after storage setup to save an assessment. Free lessons are available above.</p>}
          {grade?.feedback ? <div role="status" className="mt-4 rounded-xl border p-4"><p className="font-bold">{grade.score}% · {grade.passed ? "Passed" : "Review and retry"}</p><ul className="mt-3 space-y-2 text-sm leading-6">{grade.feedback.map((item, index) => <li key={index}>{index + 1}. {item.correct ? "Correct" : "Revisit"}: {item.explanation}</li>)}</ul></div> : null}
        </section>
        <section className="surface p-5"><h2 className="text-xl font-bold">Record completion honestly</h2><p className="mt-3 text-sm leading-6 text-muted-foreground">JobPilot can issue its own free completion record after saved exercises, a passed knowledge check and a project submission. It is not accredited, identity-verified or an external provider credential. Your project remains self-reported.</p>
          {credential ? <div className="mt-4"><CredentialList credentials={[credential]} busy={busy} storageReady={Boolean(data?.storageReady)} mutate={mutate} /></div> : <><p className="mt-3 text-xs leading-6">Checklist: {enrollment.completed.length}/{path.lessons.length} exercises · {bestScore >= 67 ? "Knowledge check passed" : "Knowledge check pending"} · {enrollment.project_url && enrollment.project_summary.trim().length >= 50 ? "Project supplied" : "Project pending"}{dirty ? " · Save pending edits first" : ""}</p><label className="mt-4 flex min-h-11 items-start gap-2 text-sm"><input type="checkbox" className="mt-1" disabled={!eligible || busy} checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />I completed these exercises and this is my own project. Issue a private JobPilot completion record.</label><Button className="mt-3" disabled={!eligible || !confirmed || busy || !data?.storageReady} onClick={() => void mutate({ action: "issue", pathId: path.id, confirmed })}>Issue free completion record</Button></>}
          {path.credential ? <div className="mt-5 rounded-xl border p-4"><p className="text-sm font-bold">Separate provider credential: {path.credential.title}</p><p className="mt-2 text-xs leading-6 text-muted-foreground">{path.credential.requirements}</p><a href={path.credential.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary">Read official free requirements <ExternalLink className="size-3" /></a></div> : null}
          <Link href="/jobs" className="mt-4 inline-flex min-h-11 items-center text-sm text-primary underline">Explore related job opportunities →</Link>
        </section>
      </div>
    </div>
  </div>;
}
