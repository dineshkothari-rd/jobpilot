import { autofillQuestions, validatePayload } from "../../extensions/autofill/payload.mjs";

export type ApplicationAnswer = { question: string; answer: string; source: string };
export type ApplicationPackage = {
  resume_id: string | null;
  status: string;
  cover_note: string | null;
  application_answers: ApplicationAnswer[];
  checklist: string[];
  application_url: string | null;
};

export function isApplicationAnswer(value: unknown): value is ApplicationAnswer {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return ["question", "answer", "source"].every((key) => typeof row[key] === "string");
}

export function isApplicationPackage(value: unknown): value is ApplicationPackage {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return typeof row.status === "string" &&
    ["resume_id", "cover_note", "application_url"].every((key) => row[key] === null || typeof row[key] === "string") &&
    Array.isArray(row.application_answers) && row.application_answers.every(isApplicationAnswer) &&
    Array.isArray(row.checklist) && row.checklist.every((item) => typeof item === "string");
}

export function autofillPayload(applicationUrl: string, answers: ApplicationAnswer[]) {
  const url = new URL(applicationUrl);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("A secure application URL is required.");
  return JSON.stringify(validatePayload({
    version: 1,
    applicationUrl: url.href,
    fields: answers.filter((item) => autofillQuestions.includes(item.question) && item.answer.trim())
      .map(({ question, answer }) => ({ question, answer })),
  }));
}
