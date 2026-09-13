import type { InterviewQuestion } from "../interview-engine.ts";
import type { LearningTopic, WeakArea } from "../interview-learning.ts";

export type AiProviderName = "deterministic" | "external";

export type AiProviderStatus = {
  mode: "connected" | "fallback";
  provider: AiProviderName;
  model: string | null;
  reason: string;
};

export type GroundedInterviewContext = {
  job: {
    title: string;
    company: string;
    descriptionSummary: string;
    seniority: string | null;
    skills: string[];
  };
  candidate: {
    targetRole: string | null;
    experienceYears: number | null;
    skills: string[];
    resumeSignals: string[];
  };
  topic: LearningTopic | null;
  question: InterviewQuestion | null;
  answer: string | null;
  weakAreas: WeakArea[];
};

export type AiExplanation = {
  provider: AiProviderName;
  simple: string;
  deep: string;
  example: string;
  interviewRelevance: string;
  commonMistake: string;
  keyTakeaway: string;
};

export type AiQuizQuestion = {
  question: string;
  options: string[];
  correctAnswer: string;
  expectedConcepts: string[];
  explanation: string;
};

export type AiQuiz = {
  provider: AiProviderName;
  topic: string;
  questions: AiQuizQuestion[];
};

export type AiAnswerEvaluation = {
  provider: AiProviderName;
  score: number;
  rating: "Needs work" | "Developing" | "Strong" | "Excellent";
  strengths: string[];
  missingPoints: string[];
  incorrectAssumptions: string[];
  betterStructure: string;
  suggestedAnswerDirection: string;
  followUpQuestion: string;
};

export type AiRevisionPlan = {
  provider: AiProviderName;
  mustKnowConcepts: string[];
  topQuestions: string[];
  mistakesToAvoid: string[];
  reminders: string[];
  sequence: string[];
};

export type AiCoachResponse = {
  provider: AiProviderName;
  action: string;
  response: string;
};

export type AiLesson = {
  provider: AiProviderName;
  title: string;
  script: string;
  chapters: { title: string; summary: string }[];
};

export type AiAction = "explain" | "quiz" | "evaluate" | "follow-up" | "revision" | "coach" | "lesson";

export type AiActionResult =
  | AiExplanation
  | AiQuiz
  | AiAnswerEvaluation
  | AiRevisionPlan
  | AiCoachResponse
  | AiLesson;

export type InterviewAiProvider = {
  status: AiProviderStatus;
  explain(context: GroundedInterviewContext): Promise<AiExplanation>;
  quiz(context: GroundedInterviewContext): Promise<AiQuiz>;
  evaluate(context: GroundedInterviewContext): Promise<AiAnswerEvaluation>;
  followUp(context: GroundedInterviewContext): Promise<AiCoachResponse>;
  revision(context: GroundedInterviewContext): Promise<AiRevisionPlan>;
  coach(context: GroundedInterviewContext): Promise<AiCoachResponse>;
  lesson(context: GroundedInterviewContext): Promise<AiLesson>;
};
