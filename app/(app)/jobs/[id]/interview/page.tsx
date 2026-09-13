"use client";

import { Dialog } from "@base-ui/react/dialog";
import {
  ArrowLeft, ArrowRight, BookOpenCheck, BriefcaseBusiness, Check,
  CheckCircle2, ChevronLeft, Clipboard, FileText, Gauge, Lightbulb,
  Loader2, MessageSquareText, RotateCcw, Sparkles, Target, X,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { InterviewCategory, InterviewEvaluation, InterviewQuestion, InterviewSession } from "@/lib/ai/interview-engine";

type Mode = "technical" | "behavioral" | "role-specific" | "mixed";
type Stage = "setup" | "active" | "complete";
type ApplicationStatus = "saved" | "applied" | "screening" | "interview" | "offer" | "rejected" | "withdrawn";
type AnswerRecord = { answer: string; evaluation?: InterviewEvaluation };
type StudioData = {
  job: { id: string; title: string | null; company_name: string | null; seniority: string | null; location: string | null; skills: string[] | null };
  session: InterviewSession;
  matchScore: number | null;
  application: { id: string; status: ApplicationStatus } | null;
  context: { hasProfile: boolean; hasResume: boolean; hasUsableResume: boolean; resumeName: string | null };
};

const modes: { value: Mode; label: string; description: string; categories: InterviewCategory[] }[] = [
  { value: "mixed", label: "Mixed interview", description: "A balanced full-loop practice session", categories: ["technical", "role-specific", "behavioral", "hr"] },
  { value: "technical", label: "Technical", description: "Architecture, systems and core skills", categories: ["technical"] },
  { value: "behavioral", label: "Behavioral", description: "Ownership, collaboration and STAR stories", categories: ["behavioral", "hr"] },
  { value: "role-specific", label: "Role-specific", description: "Fit, priorities and challenges for this job", categories: ["role-specific"] },
];
const categoryLabels: Record<InterviewCategory, string> = { technical: "Technical", behavioral: "Behavioral", "role-specific": "Role-specific", hr: "Career fit" };
const statusLabels: Record<ApplicationStatus, string> = { saved: "Saved", applied: "Applied", screening: "Screening", interview: "Interview", offer: "Offer", rejected: "Rejected", withdrawn: "Withdrawn" };
const unique = (values: string[]) => Array.from(new Set(values)).filter(Boolean);

function LoadingStudio() {
  return <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10" aria-label="Loading interview studio" role="status">
    <div className="h-5 w-36 animate-pulse rounded bg-muted" /><div className="mt-8 h-28 animate-pulse rounded-2xl bg-muted" />
    <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_320px]"><div className="h-[28rem] animate-pulse rounded-2xl bg-muted" /><div className="h-80 animate-pulse rounded-2xl bg-muted" /></div>
    <span className="sr-only">Loading interview details</span>
  </div>;
}

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<StudioData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stage, setStage] = useState<Stage>("setup");
  const [mode, setMode] = useState<Mode>("mixed");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, AnswerRecord>>({});
  const [evaluating, setEvaluating] = useState(false);
  const [evaluationError, setEvaluationError] = useState("");
  const [exitOpen, setExitOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadStudio = useCallback(async () => {
    try {
      setLoading(true); setLoadError("");
      const response = await fetch(`/api/jobs/${id}/interview`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok || !result.job || !result.session) throw new Error(result.error || "Unable to load the interview studio.");
      setData(result as StudioData);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load the interview studio.");
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadStudio(), 0);
    return () => window.clearTimeout(timer);
  }, [loadStudio]);
  const selectedMode = modes.find((item) => item.value === mode) || modes[0];
  const questions = useMemo(() => data?.session.questions.filter((question) => selectedMode.categories.includes(question.category)) || [], [data, selectedMode]);
  const question = questions[currentIndex];
  const record = question ? answers[question.id] || { answer: "" } : { answer: "" };
  const completedAnswers = questions.filter((item) => answers[item.id]?.evaluation);
  const progress = questions.length ? (completedAnswers.length / questions.length) * 100 : 0;

  useEffect(() => {
    if (stage !== "active") return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [stage]);

  const startInterview = () => { setAnswers({}); setCurrentIndex(0); setEvaluationError(""); setStage("active"); };
  const updateAnswer = (answer: string) => {
    if (!question) return;
    setEvaluationError("");
    setAnswers((current) => ({ ...current, [question.id]: { answer, evaluation: current[question.id]?.answer === answer ? current[question.id]?.evaluation : undefined } }));
  };
  const evaluate = async () => {
    if (!question || !record.answer.trim() || evaluating) return;
    try {
      setEvaluating(true); setEvaluationError("");
      const response = await fetch(`/api/jobs/${id}/interview`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ questionId: question.id, answer: record.answer }) });
      const result = await response.json();
      if (!response.ok || !result.evaluation) throw new Error(result.error || "Unable to evaluate this answer.");
      setAnswers((current) => ({ ...current, [question.id]: { answer: current[question.id]?.answer || record.answer, evaluation: result.evaluation } }));
    } catch (error) {
      setEvaluationError(error instanceof Error ? error.message : "Unable to evaluate this answer.");
    } finally { setEvaluating(false); }
  };
  const continueSession = () => {
    if (!record.evaluation) return;
    if (currentIndex === questions.length - 1) setStage("complete"); else setCurrentIndex((index) => index + 1);
  };
  const exitSession = () => { setStage("setup"); setAnswers({}); setCurrentIndex(0); setExitOpen(false); };

  if (loading) return <LoadingStudio />;
  if (loadError || !data) return <div className="mx-auto grid min-h-[70dvh] max-w-xl place-items-center px-4 py-10"><section className="surface w-full p-6 text-center sm:p-8" role="alert">
    <div className="mx-auto grid size-11 place-items-center rounded-xl bg-destructive/10 text-destructive"><X /></div><h1 className="mt-4 text-xl font-bold">Interview Studio unavailable</h1>
    <p className="mt-2 text-sm text-muted-foreground">{loadError || "The interview details were incomplete."}</p><div className="mt-6 flex justify-center gap-2"><Link href={`/jobs/${id}`} className={buttonVariants({ variant: "outline" })}>Back to job</Link><Button onClick={() => void loadStudio()}><RotateCcw />Retry</Button></div>
  </section></div>;
  if (stage === "setup") return <Setup data={data} mode={mode} onMode={setMode} questions={questions} onStart={startInterview} />;
  if (stage === "complete") return <Completion data={data} mode={selectedMode.label} questions={questions} answers={answers} onRestart={startInterview} />;
  if (!question) return <div className="mx-auto grid min-h-[70dvh] max-w-xl place-items-center px-4 py-10"><section className="surface p-7 text-center"><MessageSquareText className="mx-auto size-8 text-muted-foreground" /><h1 className="mt-4 text-xl font-bold">No questions available</h1><p className="mt-2 text-sm text-muted-foreground">Choose another interview mode to continue.</p><Button className="mt-5" onClick={() => setStage("setup")}>Choose a mode</Button></section></div>;

  return <div className="min-h-full pb-28 md:pb-8">
    <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur-xl"><div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
      <button type="button" onClick={() => setExitOpen(true)} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Exit interview"><X /></button>
      <div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3 text-xs font-semibold"><span className="truncate">{data.job.title || "Target role"}</span><span className="shrink-0 text-muted-foreground">{completedAnswers.length}/{questions.length} answered</span></div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-label={`${Math.round(progress)}% complete`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress)}><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress}%` }} /></div>
      </div>
    </div></header>

    <main className="mx-auto grid max-w-6xl gap-5 px-4 py-5 sm:px-6 sm:py-8 lg:grid-cols-[minmax(0,1fr)_300px]">
      <section className="surface min-w-0 overflow-hidden" aria-labelledby="question-heading">
        <div className="border-b px-5 py-4 sm:px-7"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">Question {currentIndex + 1} of {questions.length}</span><span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{categoryLabels[question.category]}</span><span className="rounded-full border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{question.difficulty}</span></div></div>
        <div className="p-5 sm:p-7">
          {question.focusArea && <p className="section-label flex items-center gap-1.5"><Target className="size-3.5 text-primary" />Focus · {question.focusArea}</p>}
          <h1 id="question-heading" className="mt-3 max-w-3xl text-xl font-bold leading-8 tracking-tight sm:text-2xl sm:leading-9">{question.question}</h1>
          <label htmlFor="interview-answer" className="mt-7 block text-sm font-bold">Your response</label><p className="mt-1 text-xs text-muted-foreground">Answer naturally and use evidence from your own experience. Your text stays in this session.</p>
          <textarea id="interview-answer" autoFocus rows={9} maxLength={12000} value={record.answer} onChange={(event) => updateAnswer(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === "Enter") { event.preventDefault(); void evaluate(); } }} placeholder="Start with the situation, explain your decisions and finish with the result…" className="mt-3 w-full resize-y rounded-2xl border bg-background px-4 py-3.5 text-sm leading-6 outline-none placeholder:text-muted-foreground/70 focus:ring-2 focus:ring-ring/40" />
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"><span>⌘/Ctrl + Enter to evaluate</span><span>{record.answer.length.toLocaleString()} / 12,000</span></div>
          {!record.evaluation && <div className="mt-5 flex justify-end"><Button size="lg" onClick={() => void evaluate()} disabled={!record.answer.trim() || evaluating}>{evaluating ? <><Loader2 className="animate-spin" />Evaluating answer…</> : <><Sparkles />Evaluate answer</>}</Button></div>}
          {evaluationError && <div className="mt-5 flex flex-col gap-3 rounded-xl border border-destructive/25 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between" role="alert"><span>{evaluationError}</span><Button size="sm" variant="outline" onClick={() => void evaluate()} disabled={evaluating}><RotateCcw />Try again</Button></div>}
          {record.evaluation && <EvaluationPanel evaluation={record.evaluation} copied={copied} onCopy={async () => { await navigator.clipboard.writeText(record.evaluation?.idealAnswerDirection || ""); setCopied(true); window.setTimeout(() => setCopied(false), 1500); }} />}
        </div>
      </section>
      <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start"><section className="surface p-5"><p className="section-label">Answer direction</p><ul className="mt-4 space-y-3">{question.whatToCover.map((item) => <li key={item} className="flex gap-2 text-sm leading-5"><Check className="mt-0.5 size-4 shrink-0 text-primary" /><span>{item}</span></li>)}</ul></section><section className="rounded-2xl border bg-muted/35 p-5"><p className="section-label">Interview context</p><p className="mt-3 text-sm font-bold">{data.job.company_name || "Target company"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{selectedMode.label} · {data.session.readinessScore}% starting readiness</p></section></aside>
    </main>

    <div className="fixed inset-x-0 bottom-[4.5rem] z-20 border-t bg-background/95 px-4 py-3 backdrop-blur-xl md:bottom-0 md:left-[272px]"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><Button variant="outline" onClick={() => setCurrentIndex((index) => index - 1)} disabled={currentIndex === 0}><ChevronLeft />Previous</Button><Button onClick={continueSession} disabled={!record.evaluation}>{currentIndex === questions.length - 1 ? <>View feedback<CheckCircle2 /></> : <>Continue<ArrowRight /></>}</Button></div></div>
    <Dialog.Root open={exitOpen} onOpenChange={setExitOpen}><Dialog.Portal><Dialog.Backdrop className="fixed inset-0 z-40 bg-foreground/35 backdrop-blur-sm" /><Dialog.Popup className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background p-6 shadow-2xl"><Dialog.Title className="text-lg font-bold">Exit this interview?</Dialog.Title><Dialog.Description className="mt-2 text-sm leading-6 text-muted-foreground">Your answers are kept only during this active session and will be cleared when you exit.</Dialog.Description><div className="mt-6 flex justify-end gap-2"><Dialog.Close className={buttonVariants({ variant: "outline" })}>Keep practicing</Dialog.Close><Button variant="destructive" onClick={exitSession}>Exit interview</Button></div></Dialog.Popup></Dialog.Portal></Dialog.Root>
  </div>;
}

function Setup({ data, mode, onMode, questions, onStart }: { data: StudioData; mode: Mode; onMode: (mode: Mode) => void; questions: InterviewQuestion[]; onStart: () => void }) {
  return <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-10 md:pb-10">
    <Link href={`/jobs/${data.job.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />Back to job</Link>
    <header className="mt-7 grid gap-6 border-b pb-7 md:grid-cols-[1fr_auto] md:items-end"><div><p className="section-label flex items-center gap-2 text-primary"><Sparkles className="size-4" />AI Interview Studio</p><h1 className="mt-3 text-3xl font-bold tracking-[-0.035em] sm:text-4xl">Practice for {data.job.title || "your target role"}</h1><p className="mt-2 text-sm font-medium text-muted-foreground">{data.job.company_name || "Target company"}{data.job.location ? ` · ${data.job.location}` : ""}{data.job.seniority ? ` · ${data.job.seniority}` : ""}</p></div><div className="flex gap-3"><Metric label="Job match" value={data.matchScore == null ? "—" : `${data.matchScore}%`} /><Metric label="Readiness" value={`${data.session.readinessScore}%`} /></div></header>
    {(!data.context.hasProfile || !data.context.hasUsableResume) && <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="font-bold">Practice is available, but personalization is limited.</p><p className="mt-1 text-xs text-muted-foreground">{!data.context.hasProfile ? "Complete your profile" : data.context.hasResume ? "Your primary resume has no usable skills" : "Add a primary resume"} for more accurate readiness and focus areas.</p></div><Link href={!data.context.hasProfile ? "/profile" : "/resume"} className={buttonVariants({ variant: "outline", size: "sm" })}>Improve context<ArrowRight /></Link></div>}
    <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="surface p-5 sm:p-7" aria-labelledby="mode-heading"><div className="flex items-start justify-between gap-4"><div><p className="section-label">Session setup</p><h2 id="mode-heading" className="mt-2 text-xl font-bold">Choose your interview mode</h2></div><span className="rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary">Text practice</span></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2" role="radiogroup" aria-label="Interview mode">{modes.map((item) => { const count = data.session.questions.filter((question) => item.categories.includes(question.category)).length; const active = mode === item.value; return <button key={item.value} type="button" role="radio" aria-checked={active} onClick={() => onMode(item.value)} className={cn("min-h-28 rounded-2xl border p-4 text-left transition", active ? "border-primary bg-primary/[0.06] ring-1 ring-primary" : "hover:border-primary/30 hover:bg-muted/40")}><span className="flex items-center justify-between gap-3"><span className="font-bold">{item.label}</span>{active && <CheckCircle2 className="size-5 text-primary" />}</span><span className="mt-2 block text-xs leading-5 text-muted-foreground">{item.description}</span><span className="mt-3 block text-[11px] font-semibold text-muted-foreground">{count} questions</span></button>; })}</div>
        <div className="mt-7 flex flex-col gap-3 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"><p className="text-xs leading-5 text-muted-foreground">Deterministic feedback based on answer structure, evidence and expected coverage.</p><Button size="xl" onClick={onStart} disabled={!questions.length}>Start interview<ArrowRight /></Button></div>
      </section>
      <aside className="space-y-4"><section className="surface p-5"><p className="section-label">Priority focus</p><ul className="mt-4 space-y-3">{data.session.focusAreas.slice(0, 5).map((area) => <li key={area} className="flex gap-2 text-sm leading-5"><Target className="mt-0.5 size-4 shrink-0 text-primary" />{area}</li>)}</ul></section><section className="surface p-5"><p className="section-label">Application</p>{data.application ? <><div className="mt-3 flex items-center justify-between gap-3"><span className="text-sm font-bold">In your pipeline</span><span className="rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-bold text-primary">{statusLabels[data.application.status]}</span></div><Link href="/applications" className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-4 w-full`}>Open application<ArrowRight /></Link></> : <><p className="mt-3 text-sm font-bold">Not in your pipeline</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Review the job before applying. No application will be created here.</p><Link href={`/jobs/${data.job.id}`} className={`${buttonVariants({ variant: "outline", size: "sm" })} mt-4 w-full`}>Review & apply<ArrowRight /></Link></>}</section></aside>
    </div>
    <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Related preparation tools"><ToolLink href={`/jobs/${data.job.id}/prepare`} icon={<BookOpenCheck />} label="Job preparation" detail="Topics and preparation plan" /><ToolLink href={`/jobs/${data.job.id}/copilot`} icon={<Sparkles />} label="Application Copilot" detail="Tailor your application" /><ToolLink href={`/jobs/${data.job.id}`} icon={<BriefcaseBusiness />} label="Job detail" detail="Review requirements" /><ToolLink href="/applications" icon={<FileText />} label="Applications" detail="Return to your pipeline" /></section>
  </main>;
}

function EvaluationPanel({ evaluation, copied, onCopy }: { evaluation: InterviewEvaluation; copied: boolean; onCopy: () => void }) {
  return <section className="mt-7 overflow-hidden rounded-2xl border" aria-live="polite"><div className="flex items-center justify-between gap-4 border-b bg-muted/35 p-5"><div><p className="section-label">Deterministic evaluation</p><h2 className="mt-1 text-lg font-bold">{evaluation.quality} answer</h2></div><div className="grid size-16 place-items-center rounded-full border-4 border-primary/20 text-xl font-bold text-primary">{evaluation.score}</div></div><div className="grid gap-6 p-5 sm:grid-cols-2"><FeedbackList title="What worked" items={evaluation.strengths} positive /><FeedbackList title="What to improve" items={evaluation.weaknesses} /><FeedbackList title="Missing points" items={evaluation.missingPoints.length ? evaluation.missingPoints : ["No major expected point was missed."]} /><div><h3 className="text-sm font-bold">Suggested improvement</h3><p className="mt-2 text-sm leading-6 text-muted-foreground">{evaluation.suggestedImprovement}</p></div></div><div className="border-t bg-primary/[0.04] p-5"><div className="flex items-center justify-between gap-3"><h3 className="flex items-center gap-2 text-sm font-bold"><Lightbulb className="size-4 text-primary" />Ideal answer direction</h3><button type="button" onClick={onCopy} className={buttonVariants({ variant: "ghost", size: "sm" })}>{copied ? <Check /> : <Clipboard />}{copied ? "Copied" : "Copy"}</button></div><p className="mt-2 text-sm leading-6 text-muted-foreground">{evaluation.idealAnswerDirection}</p></div></section>;
}

function Completion({ data, mode, questions, answers, onRestart }: { data: StudioData; mode: string; questions: InterviewQuestion[]; answers: Record<string, AnswerRecord>; onRestart: () => void }) {
  const evaluations = questions
    .map((question) => answers[question.id]?.evaluation)
    .filter((evaluation): evaluation is InterviewEvaluation => Boolean(evaluation));
  const performance = evaluations.length ? Math.round(evaluations.reduce((sum, item) => sum + item.score, 0) / evaluations.length) : 0;
  const readiness = Math.round(data.session.readinessScore * 0.35 + performance * 0.65);
  const strengths = unique(evaluations.flatMap((item) => item.strengths)).slice(0, 4);
  const improvements = unique(evaluations.flatMap((item) => [...item.weaknesses, ...item.missingPoints.map((point) => `Add evidence about ${point.toLowerCase()}.`)])).slice(0, 5);
  const performanceLabel = performance >= 85 ? "Interview-ready" : performance >= 70 ? "Strong foundation" : performance >= 55 ? "Developing" : "More practice recommended";
  return <main className="mx-auto max-w-6xl px-4 py-6 pb-28 sm:px-6 sm:py-10 md:pb-10"><header className="surface overflow-hidden"><div className="bg-primary/[0.06] p-6 sm:p-8"><p className="section-label flex items-center gap-2 text-primary"><CheckCircle2 className="size-4" />Session complete</p><div className="mt-3 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-bold tracking-tight">{performanceLabel}</h1><p className="mt-2 text-sm text-muted-foreground">{mode} practice for {data.job.title || "your target role"} at {data.job.company_name || "the target company"}</p></div><div className="flex gap-3"><Metric label="Performance" value={`${performance}%`} /><Metric label="Readiness" value={`${readiness}%`} /></div></div></div><div className="grid gap-3 border-t p-5 text-sm sm:grid-cols-3 sm:p-6"><p><span className="block text-xs text-muted-foreground">Questions answered</span><strong className="mt-1 block">{evaluations.length} of {questions.length}</strong></p><p><span className="block text-xs text-muted-foreground">Starting readiness</span><strong className="mt-1 block">{data.session.readinessScore}%</strong></p><p><span className="block text-xs text-muted-foreground">Job match</span><strong className="mt-1 block">{data.matchScore == null ? "Not available" : `${data.matchScore}%`}</strong></p></div></header>
    <div className="mt-5 grid gap-5 lg:grid-cols-2"><section className="surface p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="size-5 text-emerald-600" />Strengths</h2><FeedbackList title="" items={strengths.length ? strengths : data.session.strengths} positive /></section><section className="surface p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><Target className="size-5 text-primary" />Improvement areas</h2><FeedbackList title="" items={improvements.length ? improvements : data.session.focusAreas} /></section><section className="surface p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><Gauge className="size-5 text-primary" />Focus next</h2><ul className="mt-4 space-y-3">{data.session.focusAreas.map((area) => <li key={area} className="rounded-xl bg-muted/45 p-3 text-sm leading-5">{area}</li>)}</ul></section><section className="surface p-5 sm:p-6"><h2 className="flex items-center gap-2 text-lg font-bold"><BookOpenCheck className="size-5 text-primary" />Recommended next steps</h2><div className="mt-4 grid gap-2"><Link href={`/jobs/${data.job.id}/prepare`} className={buttonVariants({ variant: "outline" })}>Review job preparation<ArrowRight /></Link><Link href={`/jobs/${data.job.id}/copilot`} className={buttonVariants({ variant: "outline" })}>Open Application Copilot<ArrowRight /></Link><Button onClick={onRestart}><RotateCcw />Practice this mode again</Button></div></section></div><p className="mt-5 text-center text-xs text-muted-foreground">Scores are deterministic coaching signals, not predictions of hiring outcomes. This session is not saved.</p>
  </main>;
}

function FeedbackList({ title, items, positive = false }: { title: string; items: string[]; positive?: boolean }) {
  return <div className={title ? "" : "mt-4"}>{title && <h3 className="text-sm font-bold">{title}</h3>}<ul className={cn("space-y-2", title && "mt-2")}>{items.map((item) => <li key={item} className="flex gap-2 text-sm leading-6 text-muted-foreground">{positive ? <Check className="mt-1 size-4 shrink-0 text-emerald-600" /> : <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />}{item}</li>)}</ul></div>;
}
function Metric({ label, value }: { label: string; value: string }) { return <div className="min-w-24 rounded-2xl border bg-background px-4 py-3 text-center"><span className="block text-xl font-bold">{value}</span><span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span></div>; }
function ToolLink({ href, icon, label, detail }: { href: string; icon: React.ReactNode; label: string; detail: string }) { return <Link href={href} className="interactive-card flex items-center gap-3 rounded-2xl border bg-background p-4"><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary [&_svg]:size-4">{icon}</span><span className="min-w-0"><strong className="block text-sm">{label}</strong><span className="block truncate text-[11px] text-muted-foreground">{detail}</span></span><ArrowRight className="ml-auto size-4 shrink-0 text-muted-foreground" /></Link>; }
