"use client";

import { Button, buttonVariants } from "@/components/ui/button";
import type { InterviewPreparationHub, LearningTopic, VideoLesson } from "@/lib/ai/interview-learning";
import type { AiAction, AiActionResult, AiProviderStatus } from "@/lib/ai/providers/types";
import type { LearningResource, ResourceProviderStatus } from "@/lib/resources/types";
import { cn } from "@/lib/utils";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  CheckCircle2,
  Code2,
  FileText,
  Loader2,
  MessageSquareText,
  PlayCircle,
  RefreshCw,
  Search,
  Sparkles,
  Target,
  Timer,
  Video,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

type PrepResponse = {
  success: true;
  job: {
    id: string;
    title: string | null;
    company_name: string | null;
    location: string | null;
    seniority: string | null;
    employment_type: string | null;
    skills: string[] | null;
  };
  matchScore: number | null;
  application: { id: string; status: string; follow_up_at: string | null } | null;
  context: {
    hasProfile: boolean;
    hasResume: boolean;
    hasUsableResume: boolean;
    targetRole: string | null;
    resumeName: string | null;
  };
  hub: InterviewPreparationHub;
  providerStatus: {
    ai: AiProviderStatus;
    resources: ResourceProviderStatus;
  };
};

type SectionId = "plan" | "lessons" | "questions" | "coding" | "resources" | "revision";

const sections: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: "plan", label: "Plan", icon: <BookOpenCheck /> },
  { id: "lessons", label: "Lessons", icon: <Video /> },
  { id: "questions", label: "Questions", icon: <MessageSquareText /> },
  { id: "coding", label: "Coding", icon: <Code2 /> },
  { id: "resources", label: "Resources", icon: <BookOpenCheck /> },
  { id: "revision", label: "Revision", icon: <Timer /> },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

function isPrepResponse(value: unknown): value is PrepResponse {
  return isRecord(value) && value.success === true && isRecord(value.job) && isRecord(value.hub);
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-2xl bg-muted", className)} aria-hidden="true" />;
}

function ScoreRing({ value }: { value: number | null }) {
  const score = value || 0;
  return (
    <div
      role="img"
      aria-label={value == null ? "Interview readiness unavailable" : `Interview readiness ${value}%`}
      className="grid size-28 shrink-0 place-items-center rounded-full"
      style={{
        background: value == null
          ? "var(--muted)"
          : `conic-gradient(var(--primary) ${score * 3.6}deg, var(--muted) 0deg)`,
      }}
    >
      <div className="grid size-20 place-items-center rounded-full bg-background text-center">
        <div>
          <p className="text-2xl font-bold">{value == null ? "--" : value}</p>
          <p className="text-[9px] font-bold uppercase text-muted-foreground">ready</p>
        </div>
      </div>
    </div>
  );
}

function TopicCard({
  topic,
  reviewed,
  onReview,
}: {
  topic: LearningTopic;
  reviewed: boolean;
  onReview: () => void;
}) {
  return (
    <article className="rounded-2xl border bg-background/70 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold capitalize">{topic.title}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {topic.category} · {topic.difficulty} · {topic.estimatedMinutes} min
          </p>
        </div>
        <span className={cn(
          "rounded-full px-2.5 py-1 text-[10px] font-bold",
          topic.importance === "High" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
        )}>
          {topic.importance}
        </span>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">{topic.shortExplanation}</p>
      <details className="mt-3 rounded-xl border bg-card p-3">
        <summary className="cursor-pointer text-xs font-bold">Open lesson notes</summary>
        <div className="mt-3 space-y-4 text-sm leading-6 text-muted-foreground">
          <p>{topic.detailedExplanation}</p>
          <List title="Key concepts" items={topic.keyConcepts} />
          <List title="Common questions" items={topic.questions} />
          <List title="Mistakes" items={topic.commonMistakes} />
          <p><strong className="text-foreground">Practice:</strong> {topic.practiceTask}</p>
        </div>
      </details>
      <Button className="mt-3 w-full" variant={reviewed ? "outline" : "default"} onClick={onReview}>
        {reviewed ? <CheckCircle2 /> : <Check />}
        {reviewed ? "Reviewed this session" : "Mark reviewed"}
      </Button>
    </article>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function VideoLessonCard({ lesson }: { lesson: VideoLesson }) {
  return (
    <article className="overflow-hidden rounded-2xl border bg-background/70">
      <div className="aspect-video bg-foreground text-background">
        {lesson.videoUrl ? (
          <video src={lesson.videoUrl} controls className="size-full" />
        ) : (
          <div className="flex size-full flex-col items-center justify-center p-5 text-center">
            <PlayCircle className="size-10 opacity-80" />
            <p className="mt-3 text-sm font-bold">Your lesson outline</p>
            <p className="mt-1 max-w-sm text-xs opacity-75">Video generation provider not configured. Use the narration-ready lesson below.</p>
          </div>
        )}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold">{lesson.title}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{lesson.durationMinutes} min · {lesson.providerStatus === "available" ? "Video available" : "Script mode"}</p>
          </div>
          <Video className="size-4 text-primary" />
        </div>
        <details className="mt-3">
          <summary className="cursor-pointer text-xs font-bold text-primary">Read script and chapters</summary>
          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-muted-foreground">{lesson.script}</p>
          <div className="mt-4 space-y-2">
            {lesson.chapters.map((chapter) => (
              <div key={`${chapter.startMinute}-${chapter.title}`} className="rounded-xl border p-3 text-xs">
                <strong>{chapter.startMinute}:00 · {chapter.title}</strong>
                <p className="mt-1 text-muted-foreground">{chapter.summary}</p>
              </div>
            ))}
          </div>
        </details>
      </div>
    </article>
  );
}

function StatusBadge({ label, status }: { label: string; status: { mode: string; reason: string } }) {
  return (
    <span title={status.reason} className="rounded-full border bg-background/70 px-3 py-1 text-xs font-bold">
      {label}: {status.mode === "connected" ? "connected" : status.mode === "fallback" ? "fallback" : "not configured"}
    </span>
  );
}

function AiResultPanel({ result }: { result: AiActionResult }) {
  if ("questions" in result) {
    return (
      <div className="space-y-3">
        {result.questions.map((question) => (
          <div key={question.question} className="rounded-xl border bg-background/70 p-3">
            <p className="font-bold">{question.question}</p>
            <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
              {question.options.map((option) => <li key={option}>• {option}</li>)}
            </ul>
            <p className="mt-2 text-xs"><strong>Answer:</strong> {question.correctAnswer}</p>
            <p className="mt-1 text-xs text-muted-foreground">{question.explanation}</p>
          </div>
        ))}
      </div>
    );
  }

  if ("score" in result) {
    return (
      <div className="space-y-3">
        <p className="text-lg font-bold">{result.score}% · {result.rating}</p>
        <List title="Strengths" items={result.strengths.length ? result.strengths : ["No clear strengths detected yet."]} />
        <List title="Missing points" items={result.missingPoints.length ? result.missingPoints : ["No major missing points detected."]} />
        {result.incorrectAssumptions.length > 0 && <List title="Possible incorrect assumptions" items={result.incorrectAssumptions} />}
        <p className="rounded-xl border bg-muted/35 p-3 text-sm leading-6">{result.betterStructure}</p>
        <p className="text-sm leading-6 text-muted-foreground">{result.suggestedAnswerDirection}</p>
        <p className="text-sm font-bold text-primary">{result.followUpQuestion}</p>
      </div>
    );
  }

  if ("mustKnowConcepts" in result) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        <List title="Must know" items={result.mustKnowConcepts} />
        <List title="Top questions" items={result.topQuestions} />
        <List title="Avoid" items={result.mistakesToAvoid} />
        <List title="Sequence" items={result.sequence} />
      </div>
    );
  }

  if ("script" in result) {
    return (
      <div>
        <p className="font-bold">{result.title}</p>
        <p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{result.script}</p>
      </div>
    );
  }

  if ("simple" in result) {
    return (
      <div className="space-y-3 text-sm leading-6">
        <p><strong>Simple:</strong> {result.simple}</p>
        <p><strong>Deep:</strong> {result.deep}</p>
        <p><strong>Example:</strong> {result.example}</p>
        <p><strong>Interview angle:</strong> {result.interviewRelevance}</p>
        <p><strong>Mistake:</strong> {result.commonMistake}</p>
        <p><strong>Takeaway:</strong> {result.keyTakeaway}</p>
      </div>
    );
  }

  return <p className="text-sm leading-6 text-muted-foreground">{"response" in result ? result.response : "No response."}</p>;
}

function ResourceCard({ resource }: { resource: LearningResource }) {
  const safeEmbed = resource.embedUrl?.startsWith("https://www.youtube-nocookie.com/embed/") ? resource.embedUrl : null;

  return (
    <article className="overflow-hidden rounded-2xl border bg-background/70">
      {safeEmbed && (
        <iframe
          title={resource.title}
          src={safeEmbed}
          className="aspect-video w-full"
          loading="lazy"
          allow="accelerometer; encrypted-media; picture-in-picture"
          allowFullScreen
        />
      )}
      <div className="p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">{resource.type} · {resource.source}</p>
        <h3 className="mt-2 font-bold">{resource.title}</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{resource.description}</p>
        <a href={resource.url} target="_blank" rel="noopener noreferrer" className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}>
          Open resource
          <ArrowRight />
        </a>
      </div>
    </article>
  );
}

export function PrepareHubClient() {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<PrepResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [section, setSection] = useState<SectionId>("plan");
  const [search, setSearch] = useState("");
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [openQuestion, setOpenQuestion] = useState("");
  const [coachResponse, setCoachResponse] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [selectedTopicId, setSelectedTopicId] = useState("");
  const [selectedQuestionId, setSelectedQuestionId] = useState("");
  const [aiLoading, setAiLoading] = useState<AiAction | "">("");
  const [aiError, setAiError] = useState("");
  const [aiResult, setAiResult] = useState<AiActionResult | null>(null);
  const [resources, setResources] = useState<LearningResource[]>([]);
  const [resourceStatus, setResourceStatus] = useState<ResourceProviderStatus | null>(null);
  const [resourceLoading, setResourceLoading] = useState(false);
  const [resourceError, setResourceError] = useState("");

  const load = useCallback(async (refresh = false) => {
    try {
      if (refresh) setRefreshing(true);
      else setLoading(true);
      setError("");

      const response = await fetch(`/api/jobs/${id}/prepare`, { cache: "no-store" });
      const result: unknown = await response.json();

      if (!response.ok) {
        throw new Error(isRecord(result) && typeof result.error === "string" ? result.error : "Unable to load preparation.");
      }
      if (!isPrepResponse(result)) {
        throw new Error("Preparation response was incomplete.");
      }

      setData(result);
      setCoachResponse(result.hub.coachActions[0]?.response || "");
      setSelectedTopicId(result.hub.learningTopics[0]?.id || "");
      setSelectedQuestionId(result.hub.questionBank[0]?.id || "");
    } catch (loadError) {
      console.error("PREPARATION HUB LOAD ERROR:", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load preparation.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [id]);

  const runAi = useCallback(async (action: AiAction) => {
    try {
      setAiLoading(action);
      setAiError("");
      const topic = data?.hub.learningTopics.find((item) => item.id === selectedTopicId) || data?.hub.learningTopics[0];
      const question = data?.hub.questionBank.find((item) => item.id === selectedQuestionId) || data?.hub.questionBank[0];
      const response = await fetch("/api/ai/interview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jobId: id,
          action,
          topicId: topic?.id,
          questionId: question?.id,
          answer: action === "evaluate" ? answerText : undefined,
        }),
      });
      const result = await response.json() as { error?: string; result?: AiActionResult };
      if (!response.ok || !result.result) throw new Error(result.error || "AI action failed.");
      setAiResult(result.result);
      if ("response" in result.result) setCoachResponse(result.result.response);
    } catch (runError) {
      setAiError(runError instanceof Error ? runError.message : "AI action failed.");
    } finally {
      setAiLoading("");
    }
  }, [answerText, data, id, selectedQuestionId, selectedTopicId]);

  const loadResources = useCallback(async () => {
    if (!data || resources.length || resourceLoading) return;

    try {
      setResourceLoading(true);
      setResourceError("");
      const topic = data.hub.learningTopics.find((item) => item.id === selectedTopicId) || data.hub.learningTopics[0];
      const params = new URLSearchParams({ jobId: id });
      if (topic?.title) params.set("topic", topic.title);
      const response = await fetch(`/api/resources/interview?${params}`, { cache: "no-store" });
      const result = await response.json() as { error?: string; resources?: LearningResource[]; status?: ResourceProviderStatus };
      if (!response.ok || !Array.isArray(result.resources) || !result.status) {
        throw new Error(result.error || "Unable to load resources.");
      }
      setResources(result.resources);
      setResourceStatus(result.status);
    } catch (loadError) {
      setResourceError(loadError instanceof Error ? loadError.message : "Unable to load resources.");
    } finally {
      setResourceLoading(false);
    }
  }, [data, id, resourceLoading, resources.length, selectedTopicId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const filteredTopics = useMemo(() => {
    if (!data) return [];
    const term = search.trim().toLowerCase();
    return data.hub.learningTopics.filter((topic) =>
      !term ||
      topic.title.toLowerCase().includes(term) ||
      topic.category.toLowerCase().includes(term) ||
      topic.keyConcepts.some((concept) => concept.toLowerCase().includes(term)),
    );
  }, [data, search]);

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-5 pb-28 sm:px-6 lg:px-8">
        <Skeleton className="h-40" />
        <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto grid min-h-[70dvh] max-w-xl place-items-center px-4 py-10">
        <section className="surface w-full p-6 text-center" role="alert">
          <AlertCircle className="mx-auto size-10 text-destructive" />
          <h1 className="mt-4 text-xl font-bold">Preparation unavailable</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{error || "Please retry."}</p>
          <div className="mt-5 flex justify-center gap-2">
            <Link href="/jobs" className={buttonVariants({ variant: "outline" })}>Back to jobs</Link>
            <Button onClick={() => void load(true)} disabled={refreshing}>{refreshing ? <Loader2 className="animate-spin" /> : <RefreshCw />}Retry</Button>
          </div>
        </section>
      </div>
    );
  }

  const hub = data.hub;
  const progress = hub.progress.totalTopics
    ? Math.round((reviewed.size / hub.progress.totalTopics) * 100)
    : 0;

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 pb-28 sm:px-6 lg:px-8">
      <Link href={`/jobs/${data.job.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Back to job
      </Link>

      <nav className="journey-navigation mt-5 grid gap-2 sm:grid-cols-4" aria-label="Application journey">
        {[{label:"Review role",href:`/jobs/${data.job.id}`},{label:"Prepare application",href:`/jobs/${data.job.id}/copilot`},{label:"Apply via job page",href:`/jobs/${data.job.id}`},{label:"Confirm & track",href:"/applications"}].map(({label,href},index) => <Link key={label} href={href} className="journey-stop flex min-h-11 items-center gap-3 rounded-xl p-3 text-xs font-semibold"><span className="text-muted-foreground">0{index + 1}</span>{label}<ArrowRight className="ml-auto size-3.5" /></Link>)}
      </nav>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">Preparation does not submit an application. Apply through the job’s application link, then confirm your submission in Applications.</p>

      <section className="ai-surface mt-5 rounded-2xl border border-primary/10 p-5 shadow-[var(--shadow-soft)] sm:p-6">
        <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="min-w-0">
            <p className="section-label flex items-center gap-2 text-primary"><Sparkles className="size-4" />Get ready for this interview</p>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">{data.job.title || "Interview preparation"}</h1>
            <p className="mt-2 text-sm font-medium text-muted-foreground">
              {data.job.company_name || "Target company"}{data.job.location ? ` · ${data.job.location}` : ""}{data.job.seniority ? ` · ${data.job.seniority}` : ""}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="rounded-full border bg-background/70 px-3 py-1 text-xs font-bold">Match {data.matchScore == null ? "unavailable" : `${data.matchScore}%`}</span>
              <span className="rounded-full border bg-background/70 px-3 py-1 text-xs font-bold">{hub.readiness.progressLabel}: {progress}%</span>
              {data.context.targetRole && <span className="rounded-full border bg-background/70 px-3 py-1 text-xs font-bold">Target {data.context.targetRole}</span>}
              <StatusBadge label="AI" status={data.providerStatus.ai} />
              <StatusBadge label="Resources" status={data.providerStatus.resources} />
            </div>
          </div>
          <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center lg:flex-col">
            <ScoreRing value={hub.readiness.score} />
            <Link href={hub.readiness.primaryCta.href} className={buttonVariants({ size: "lg" })}>
              {hub.readiness.primaryCta.label}
              <ArrowRight />
            </Link>
          </div>
        </div>
      </section>

      {(!data.context.hasProfile || !data.context.hasUsableResume) && (
        <section className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-500/25 bg-amber-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold">Personalization is limited</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              {!data.context.hasProfile ? "Complete your profile" : data.context.hasResume ? "Your primary resume has no usable skills" : "Upload a primary resume"} for stronger readiness and resume-grounded answers.
            </p>
          </div>
          <Link href={!data.context.hasProfile ? "/profile" : "/resume"} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Improve context
            <ArrowRight />
          </Link>
        </section>
      )}

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0">
          <nav className="sticky top-0 z-20 flex gap-1 overflow-x-auto rounded-2xl border bg-background/95 p-1.5 backdrop-blur" aria-label="Preparation sections">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setSection(item.id);
                  if (item.id === "resources") void loadResources();
                }}
                aria-current={section === item.id ? "page" : undefined}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-xl px-3 text-xs font-bold [&_svg]:size-3.5",
                  section === item.id ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          {section === "plan" && (
            <div className="mt-5 space-y-5">
              <section className="surface p-5 sm:p-6">
                <p className="section-label">Readiness breakdown</p>
                <h2 className="mt-1 text-xl font-bold">{hub.readiness.label}</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {hub.readiness.breakdown.map((item) => (
                    <div key={item.label} className="rounded-xl border bg-background/70 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-bold">{item.label}</p>
                        <span className="font-bold text-primary">{item.value == null ? "--" : `${item.value}%`}</span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="surface p-5 sm:p-6">
                <p className="section-label">Personalized plan</p>
                <h2 className="mt-1 text-xl font-bold">Foundation to final review</h2>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {hub.studyPlan.map((item) => (
                    <article key={item.phase} className="rounded-2xl border bg-background/70 p-4">
                      <p className="text-xs font-bold text-primary">{item.phase}</p>
                      <h3 className="mt-2 font-bold">{item.title}</h3>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.why}</p>
                      <p className="mt-3 text-xs font-bold"><Timer className="mr-1 inline size-3.5" />{item.effort}</p>
                      <p className="mt-2 text-sm leading-6">{item.action}</p>
                    </article>
                  ))}
                </div>
              </section>

              <section id="weak-areas" className="surface p-5 sm:p-6">
                <p className="section-label">Weak areas</p>
                <h2 className="mt-1 text-xl font-bold">Practice these first</h2>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {hub.weakAreas.map((area) => (
                    <article key={area.title} className="rounded-xl border bg-background/70 p-4">
                      <p className="font-bold">{area.title}</p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">{area.why}</p>
                      <button type="button" onClick={() => setSection("questions")} className="mt-3 text-xs font-bold text-primary hover:underline">Practice this</button>
                    </article>
                  ))}
                </div>
              </section>
            </div>
          )}

          {section === "lessons" && (
            <div className="mt-5 space-y-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search topics" aria-label="Search learning topics" className="h-11 w-full rounded-xl border bg-background pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring/40" />
              </div>
              <section className="grid gap-4 lg:grid-cols-2">
                {filteredTopics.map((topic) => (
                  <TopicCard
                    key={topic.id}
                    topic={topic}
                    reviewed={reviewed.has(topic.id)}
                    onReview={() => setReviewed((current) => {
                      const next = new Set(current);
                      if (next.has(topic.id)) next.delete(topic.id);
                      else next.add(topic.id);
                      return next;
                    })}
                  />
                ))}
              </section>
              <section className="surface p-5 sm:p-6">
                <p className="section-label">Video lesson architecture</p>
                <h2 className="mt-1 text-xl font-bold">Script mode until a provider is configured</h2>
                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  {hub.videoLessons.map((lesson) => <VideoLessonCard key={lesson.topicId} lesson={lesson} />)}
                </div>
              </section>
            </div>
          )}

          {section === "questions" && (
            <section className="mt-5 surface p-5 sm:p-6">
              <p className="section-label">Likely based on this role</p>
              <h2 className="mt-1 text-xl font-bold">Interview question bank</h2>
              <div className="mt-5 space-y-3">
                {hub.questionBank.map((question) => (
                  <article key={question.id} className="rounded-2xl border bg-background/70 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{question.category} · {question.difficulty}</p>
                        <h3 className="mt-2 font-bold leading-6">{question.question}</h3>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">{question.whyItMayBeAsked}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => {
                        setSelectedQuestionId(question.id);
                        setOpenQuestion(openQuestion === question.id ? "" : question.id);
                      }}>
                        {openQuestion === question.id ? "Hide" : "Reveal"} guidance
                      </Button>
                    </div>
                    {openQuestion === question.id && (
                      <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                        <List title="Strong answer covers" items={question.strongAnswerShouldCover} />
                        <List title="Follow-ups" items={question.followUps} />
                        <div className="sm:col-span-2">
                          <label className="text-xs font-bold uppercase tracking-wide">Practice answer</label>
                          <textarea
                            value={answerText}
                            onChange={(event) => setAnswerText(event.target.value.slice(0, 12000))}
                            className="mt-2 min-h-28 w-full rounded-xl border bg-background p-3 text-sm outline-none focus:ring-2 focus:ring-ring/40"
                            placeholder="Paste or type your answer, then request evaluation."
                          />
                          <Button className="mt-2" size="sm" onClick={() => void runAi("evaluate")} disabled={Boolean(aiLoading) || answerText.trim().length < 20}>
                            {aiLoading === "evaluate" ? <Loader2 className="animate-spin" /> : <Sparkles />}
                            Evaluate Answer
                          </Button>
                        </div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
              <Link href={`/jobs/${data.job.id}/interview`} className={cn(buttonVariants({ size: "lg" }), "mt-5 w-full sm:w-auto")}>
                Start Mock Interview
                <ArrowRight />
              </Link>
            </section>
          )}

          {section === "coding" && (
            <section className="mt-5 grid gap-4">
              {hub.codingPractice.length ? hub.codingPractice.map((item) => (
                <article key={item.title} className="surface p-5 sm:p-6">
                  <p className="section-label">{item.topic} · {item.difficulty}</p>
                  <h2 className="mt-1 text-xl font-bold">{item.title}</h2>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{item.problem}</p>
                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <List title="Expected concepts" items={item.expectedConcepts} />
                    <List title="Hints" items={item.hints} />
                    <List title="Solution approach" items={item.solutionApproach} />
                    <List title="Edge cases" items={item.edgeCases} />
                  </div>
                  <p className="mt-4 rounded-xl border bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">{item.complexity}</p>
                </article>
              )) : (
                <section className="surface p-6 text-center">
                  <Code2 className="mx-auto size-8 text-muted-foreground" />
                  <h2 className="mt-3 font-bold">No coding practice generated</h2>
                  <p className="mt-2 text-sm text-muted-foreground">This job does not expose enough technical signals for a relevant coding scenario.</p>
                </section>
              )}
            </section>
          )}

          {section === "resources" && (
            <section className="mt-5 surface p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="section-label">Learning resources</p>
                  <h2 className="mt-1 text-xl font-bold">Docs, videos, and safe search</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    {resourceStatus?.reason || data.providerStatus.resources.reason}
                  </p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={selectedTopicId}
                    onChange={(event) => {
                      setSelectedTopicId(event.target.value);
                      setResources([]);
                    }}
                    className="h-10 rounded-xl border bg-background px-3 text-sm"
                    aria-label="Resource topic"
                  >
                    {hub.learningTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
                  </select>
                  <Button variant="outline" onClick={() => void loadResources()} disabled={resourceLoading}>
                    {resourceLoading ? <Loader2 className="animate-spin" /> : <RefreshCw />}
                    Load
                  </Button>
                </div>
              </div>

              {resourceError && <p className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{resourceError}</p>}
              {resourceLoading && <Skeleton className="mt-5 h-44" />}
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                {resources.map((resource) => <ResourceCard key={resource.id} resource={resource} />)}
              </div>
            </section>
          )}

          {section === "revision" && (
            <section className="mt-5 surface p-5 sm:p-6">
              <p className="section-label">Interview tomorrow</p>
              <h2 className="mt-1 text-xl font-bold">Quick revision mode</h2>
              <div className="mt-5 grid gap-4 lg:grid-cols-2">
                <List title="Must-know concepts" items={hub.quickRevision.mustKnowConcepts} />
                <List title="Top questions" items={hub.quickRevision.topQuestions} />
                <List title="Resume stories" items={hub.quickRevision.resumeStories.length ? hub.quickRevision.resumeStories : ["Prepare examples from your actual resume before the interview."]} />
                <List title="Common mistakes" items={hub.quickRevision.mistakes} />
              </div>
              <div className="mt-6 grid gap-3 md:grid-cols-3">
                {[
                  ["30-minute plan", hub.quickRevision.thirtyMinutePlan],
                  ["1-hour plan", hub.quickRevision.oneHourPlan],
                  ["3-hour plan", hub.quickRevision.threeHourPlan],
                ].map(([title, items]) => (
                  <div key={title as string} className="rounded-2xl border bg-background/70 p-4">
                    <List title={title as string} items={items as string[]} />
                  </div>
                ))}
              </div>
            </section>
          )}
        </main>

        <aside className="space-y-4 xl:sticky xl:top-5 xl:self-start">
          <section className="surface p-5">
            <p className="section-label">Session progress</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
              <div className="h-full rounded-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-3 text-sm font-bold">{reviewed.size} of {hub.progress.totalTopics} topics reviewed</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">{hub.progress.note}</p>
          </section>

          <section className="surface p-5">
            <p className="section-label">Real AI actions</p>
            <h2 className="mt-1 text-lg font-bold">Run when needed</h2>
            <select
              value={selectedTopicId}
              onChange={(event) => setSelectedTopicId(event.target.value)}
              className="mt-3 h-10 w-full rounded-xl border bg-background px-3 text-sm"
              aria-label="AI topic"
            >
              {hub.learningTopics.map((topic) => <option key={topic.id} value={topic.id}>{topic.title}</option>)}
            </select>
            <select
              value={selectedQuestionId}
              onChange={(event) => setSelectedQuestionId(event.target.value)}
              className="mt-2 h-10 w-full rounded-xl border bg-background px-3 text-sm"
              aria-label="AI question"
            >
              {hub.questionBank.map((question) => <option key={question.id} value={question.id}>{question.question.slice(0, 72)}</option>)}
            </select>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {[
                ["explain", "Explain with AI"],
                ["quiz", "Quiz me"],
                ["follow-up", "Harder follow-up"],
                ["revision", "10-min revision"],
                ["coach", "Coach me"],
                ["lesson", "Lesson script"],
              ].map(([action, label]) => (
                <Button key={action} size="sm" variant="outline" onClick={() => void runAi(action as AiAction)} disabled={Boolean(aiLoading)}>
                  {aiLoading === action ? <Loader2 className="animate-spin" /> : <Sparkles />}
                  {label}
                </Button>
              ))}
            </div>
            {aiError && <p className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">{aiError}</p>}
            {aiResult && (
              <div className="mt-4 rounded-xl border bg-primary/[0.04] p-3">
                <p className="mb-3 text-xs font-bold uppercase tracking-wide text-primary">{aiResult.provider === "external" ? "AI provider" : "Deterministic fallback"}</p>
                <AiResultPanel result={aiResult} />
              </div>
            )}
          </section>

          <section className="surface p-5">
            <p className="section-label">Study coach</p>
            <h2 className="mt-1 text-lg font-bold">Contextual help</h2>
            <div className="mt-4 grid gap-2">
              {hub.coachActions.map((action) => (
                <button key={action.label} type="button" onClick={() => setCoachResponse(action.response)} className="rounded-xl border bg-background/70 p-3 text-left text-xs font-bold hover:bg-muted/40">
                  {action.label}
                </button>
              ))}
            </div>
            <p className="mt-4 rounded-xl border bg-primary/[0.04] p-3 text-sm leading-6 text-muted-foreground">{coachResponse}</p>
          </section>

          <section className="surface p-5">
            <p className="section-label">Role context</p>
            <List title="Job-derived" items={hub.rolePreparation.jobDerived} />
            <div className="mt-4">
              <List title="Candidate-derived" items={hub.rolePreparation.candidateDerived} />
            </div>
          </section>

          <section className="grid gap-2">
            <Link href={`/jobs/${data.job.id}/interview`} className={buttonVariants()}>
              <MessageSquareText />
              Start Mock Interview
            </Link>
            <Link href={`/jobs/${data.job.id}/copilot`} className={buttonVariants({ variant: "outline" })}>
              <FileText />
              Application Copilot
            </Link>
            <Link href="/applications" className={buttonVariants({ variant: "outline" })}>
              <BriefcaseLinkIcon />
              Applications
            </Link>
          </section>
        </aside>
      </div>
    </div>
  );
}

function BriefcaseLinkIcon() {
  return <Target className="size-4" />;
}
