import type { ApplicationAnswer } from "./package.ts";

export const applicationFactFields = [
  { question: "Phone", hint: "Include country code, e.g. +91 …" },
  { question: "Current company", hint: "Your actual employer, or Not currently employed" },
  { question: "Portfolio URL", hint: "Optional public HTTPS link" },
  { question: "Current CTC", hint: "Annual amount, currency and fixed/variable breakdown, e.g. INR 12 lakh/year (10 fixed + 2 variable)" },
  { question: "Expected compensation", hint: "Annual amount and currency, e.g. INR 18 lakh/year" },
] as const;

export type ApplicationFacts = Partial<Record<(typeof applicationFactFields)[number]["question"], string>>;

export function parseApplicationFacts(value: unknown): ApplicationFacts {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Application facts must be an object.");
  const allowed = new Set<string>(applicationFactFields.map((field) => field.question));
  const entries = Object.entries(value);
  if (entries.some(([key, answer]) => !allowed.has(key) || typeof answer !== "string" || answer.length > 1000)) {
    throw new Error("Only supported answers of up to 1,000 characters can be saved.");
  }
  const facts = Object.fromEntries(entries.map(([key, answer]) => [key, (answer as string).trim()])) as ApplicationFacts;
  if (facts["Portfolio URL"]) {
    let url;
    try { url = new URL(facts["Portfolio URL"]); } catch { throw new Error("Portfolio must be a valid public HTTPS URL."); }
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname.includes(".") || /^[\d.]+$/.test(url.hostname) || url.hostname.endsWith(".local")) {
      throw new Error("Portfolio must be a valid public HTTPS URL.");
    }
  }
  return facts;
}

export function candidateAnswersWithFacts(answers: ApplicationAnswer[], value: unknown): ApplicationAnswer[] {
  let facts: ApplicationFacts;
  try { facts = parseApplicationFacts(value); } catch { return answers; }
  return [
    ...answers.filter((answer) => !Object.hasOwn(facts, answer.question)),
    ...Object.entries(facts).filter(([, answer]) => answer?.trim()).map(([question, answer]) => ({
      question, answer: answer!, source: "Your saved application facts — verify for this employer",
    })),
  ];
}

export function mergeApplicationAnswers(candidate: ApplicationAnswer[], prepared: ApplicationAnswer[]) {
  // Current candidate facts take precedence over an older prepared snapshot.
  const answers = new Map(prepared.map((answer) => [answer.question, answer]));
  for (const answer of candidate) answers.set(answer.question, answer);
  return [...answers.values()].filter((answer) => answer.answer.trim());
}
