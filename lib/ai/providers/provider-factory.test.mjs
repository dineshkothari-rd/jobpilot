import assert from "node:assert/strict";
import test from "node:test";

import { getInterviewAiProvider, runInterviewAiAction } from "./provider-factory.ts";

const context = {
  job: {
    title: "Frontend Engineer",
    company: "Acme",
    descriptionSummary: "Build React products.",
    seniority: "Senior",
    skills: ["React", "TypeScript"],
  },
  candidate: {
    targetRole: "Frontend Engineer",
    experienceYears: 5,
    skills: ["React"],
    resumeSignals: ["React"],
  },
  topic: {
    id: "react",
    category: "technical",
    title: "React",
    status: "recommended",
    difficulty: "Medium",
    importance: "High",
    estimatedMinutes: 30,
    shortExplanation: "React matters here.",
    detailedExplanation: "Prepare React with trade-offs and examples.",
    keyConcepts: ["components", "state"],
    questions: ["How do you structure React apps?"],
    practicalExamples: ["Use a real React project."],
    commonMistakes: ["Only defining React."],
    interviewTips: ["Use examples."],
    practiceTask: "Explain React.",
  },
  question: null,
  answer: null,
  weakAreas: [],
};

test("uses deterministic fallback when AI provider is absent", () => {
  const provider = getInterviewAiProvider({});

  assert.equal(provider.status.provider, "deterministic");
  assert.equal(provider.status.mode, "fallback");
});

test("falls back when configured provider returns malformed JSON", async () => {
  const fetcher = async () => new Response(JSON.stringify({
    choices: [{ message: { content: "{\"questions\":[]}" } }],
  }));

  const result = await runInterviewAiAction("quiz", context, {
    AI_PROVIDER: "openai-compatible",
    ALLOW_PAID_PROVIDERS: "true",
    AI_API_KEY: "test",
  }, fetcher);

  assert.equal(result.fallback, true);
  assert.equal(result.status.provider, "deterministic");
  assert.equal(result.result.provider, "deterministic");
});

test("normalizes valid external JSON", async () => {
  const fetcher = async () => new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({
      simple: "React is a UI library.",
      deep: "Explain state, rendering, and trade-offs.",
      example: "Use a real project.",
      interviewRelevance: "Relevant to frontend work.",
      commonMistake: "Skipping trade-offs.",
      keyTakeaway: "Use concrete examples.",
    }) } }],
  }));

  const result = await runInterviewAiAction("explain", context, {
    AI_PROVIDER: "openai-compatible",
    ALLOW_PAID_PROVIDERS: "true",
    AI_API_KEY: "test",
    AI_BASE_URL: "https://example.test/v1",
    AI_MODEL: "model",
  }, fetcher);

  assert.equal(result.fallback, false);
  assert.equal(result.status.provider, "external");
  assert.equal(result.result.provider, "external");
  assert.match(result.result.simple, /React/);
});

 test("free launch blocks external AI even when a provider key exists", async () => {
  let called=false;
  const result=await runInterviewAiAction("explain",context,{AI_PROVIDER:"openai-compatible",AI_API_KEY:"fixture"},async()=>{called=true;throw Error("must not fetch");});
  assert.equal(called,false);assert.equal(result.fallback,true);
});
