import { generateInterviewSession, type InterviewQuestion } from "../ai/interview-engine.ts";

export const topics = {
  frontend: { label: "Frontend", skills: ["React", "TypeScript"], path: "web-foundations" },
  react: { label: "React", skills: ["React"], path: "react-workflows" },
  javascript: { label: "JavaScript & TypeScript", skills: ["TypeScript"], path: "javascript-typescript" },
  backend: { label: "Backend & APIs", skills: ["Node.js", "API"], path: "backend-apis" },
  sql: { label: "SQL & data", skills: ["SQL"], path: "sql-data" },
} as const;
export type Topic = keyof typeof topics;
export type Mode = "technical" | "behavioral" | "mixed";
export type PracticeQuestion = InterviewQuestion & { learningPath: string; jobContext?: string; coding?: { starter: string; cases: string[]; hints: string[] } };
export type PracticeAnswer = { answer: string; code: string; checks: boolean[]; reviewed: boolean };
export type PracticeSession = {
  id: string; role: string; job_id: string | null; topic: Topic; mode: Mode; minutes: number;
  questions: PracticeQuestion[]; answers: Record<string, PracticeAnswer>; current_index: number;
  status: "active" | "complete"; version: number; created_at: string; updated_at: string;
};
export const sessionFields = "id,role,job_id,topic,mode,minutes,questions,answers,current_index,status,version,created_at,updated_at";
export const validId = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
export const blankAnswer = (): PracticeAnswer => ({ answer: "", code: "", checks: [], reviewed: false });

const originals: Record<Topic, Array<[string, string, string[]]>> = {
  frontend: [
    ["ui-loading", "Design a search screen that stays usable when requests fail or arrive out of order. What does the user see?", ["Loading, empty and error states", "Ignore stale results", "Keyboard access and retry"]],
    ["ui-access", "A dialog looks correct but a keyboard user cannot operate it. How would you investigate?", ["Focus order and focus return", "Labels and keyboard interactions", "Manual keyboard and screen-reader checks"]],
    ["ui-layout", "How would you make a long application form usable on a narrow screen?", ["Single-column layout and readable labels", "Validation without losing input", "Responsive and keyboard testing"]],
  ],
  react: [
    ["react-derived", "A selected lesson has a title. Should the title be another state variable? Explain your decision.", ["Derive the title from the selection", "Avoid competing sources of truth", "Handle missing selections"]],
    ["react-effect", "When should a React effect synchronize a subscription, and how do you stop stale updates?", ["External synchronization only", "Correct dependencies and cleanup", "Cancellation or ignoring stale work"]],
    ["react-key", "A reorderable list uses array indices as keys. What can go wrong and how would you test the fix?", ["Stable item identity", "State follows the correct item", "Test reordering with edited inputs"]],
  ],
  javascript: [
    ["js-runtime", "An API returns an unexpected object despite your TypeScript interface. How do you handle it?", ["Types do not validate runtime data", "Validate at the boundary", "Safe failure and useful error handling"]],
    ["js-promises", "Three independent requests are needed for a screen. How would you run them and handle partial failure?", ["Parallel independent work", "Promise.all versus allSettled trade-offs", "Cancellation and meaningful error states"]],
    ["js-dedupe", "Write a function that removes duplicate strings while preserving the first occurrence. Explain the trade-offs.", ["Preserve input order", "Handle empty input and duplicates", "Explain time and space complexity"]],
  ],
  backend: [
    ["api-owner", "A signed-in user changes an object ID in a request. How does your API prevent access to another user's data?", ["Authenticate and enforce ownership", "Validate IDs and payloads", "Test both allowed and denied access"]],
    ["api-retry", "A client retries a create request after a timeout. How do you prevent duplicate records?", ["Idempotency key and database uniqueness", "Return the existing operation safely", "Discuss concurrent requests and failures"]],
    ["api-contract", "How would you evolve an API field without breaking older clients?", ["Backward-compatible contract", "Validation and migration plan", "Tests and safe rollout"]],
  ],
  sql: [
    ["sql-join", "You need every customer, including those with no orders. Which join would you use and what filter mistake could drop customers?", ["LEFT JOIN preserves customers", "Explain null rows", "Right-table WHERE filters can remove unmatched rows"]],
    ["sql-index", "A query filters by user_id and orders by created_at. How would you investigate whether an index helps?", ["Inspect the query plan", "Consider an ordered composite index", "Measure reads and write overhead"]],
    ["sql-count", "Write a query returning every customer's order count, including zero. Tables: customers(id), orders(id, customer_id).", ["LEFT JOIN and GROUP BY customer ID", "COUNT(orders.id), not COUNT(*)", "Check zero orders and multiple orders"]],
  ],
};

export function buildQuestions(topic: Topic, role: string, mode: Mode, minutes: number, skills: string[] = []): PracticeQuestion[] {
  const generated = generateInterviewSession({ title: role, company: "your target company", description: "", seniority: "", skills: [...topics[topic].skills, ...skills.slice(0, 12)], candidateSkills: [], experienceYears: 0, targetRole: role }).questions;
  const own: PracticeQuestion[] = originals[topic].map(([id, question, criteria]) => ({ id, question, category: "technical", difficulty: "Medium", focusArea: topics[topic].label, whatToCover: criteria, evaluationCriteria: criteria, learningPath: topics[topic].path }));
  if (topic === "javascript") own[2].coding = { starter: "function uniqueStrings(values) {\n  // Write your solution here\n}", cases: ['[] → []', '["a", "a", "b"] → ["a", "b"]', '["A", "a"] → ["A", "a"]'], hints: ["Track values already seen.", "A Set preserves insertion order; explain its space cost."] };
  if (topic === "sql") own[2].coding = { starter: "-- Write your query here", cases: ["A customer with no orders → count 0", "A customer with two orders → count 2", "An empty customers table → no rows"], hints: ["Start from customers and preserve unmatched rows.", "Count a non-null order column."] };
  const relatedPaths: Record<string, string> = { "React architecture": "react-workflows", "React performance": "react-workflows", TypeScript: "javascript-typescript", "API design": "backend-apis", "Technical decision-making": "git-quality" };
  const existing = generated.map(q => ({ ...q, learningPath: q.category === "technical" ? relatedPaths[q.focusArea || ""] || "" : "" }));
  const technical = [...own, ...existing.filter(q => q.category === "technical")];
  const behavioral = existing.filter(q => q.category === "behavioral" || q.category === "hr");
  const selected = mode === "technical" ? technical : mode === "behavioral" ? behavioral : technical.flatMap((q, i) => [q, ...(behavioral[i] ? [behavioral[i]] : [])]).concat(behavioral.slice(technical.length));
  return selected.slice(0, minutes === 10 ? 3 : minutes === 20 ? 5 : 7);
}

export function parseSetup(value: Record<string, unknown>) {
  if (typeof value.topic !== "string" || !Object.hasOwn(topics, value.topic)) throw new Error("Choose a supported topic.");
  if (typeof value.mode !== "string" || !["technical", "behavioral", "mixed"].includes(value.mode)) throw new Error("Choose an interview mode.");
  if (typeof value.minutes !== "number" || ![10, 20, 30].includes(value.minutes)) throw new Error("Choose 10, 20 or 30 minutes.");
  if (typeof value.role !== "string" || !value.role.trim() || value.role.length > 120) throw new Error("Enter a role of 1–120 characters.");
  if (value.jobId != null && (typeof value.jobId !== "string" || !value.jobId.trim() || value.jobId.length > 200)) throw new Error("Choose a valid job.");
  return { topic: value.topic as Topic, mode: value.mode as Mode, minutes: value.minutes, role: value.role.trim(), jobId: value.jobId as string | null | undefined };
}

export function parseProgress(value: Record<string, unknown>, session: PracticeSession) {
  if (!Number.isSafeInteger(value.current_index) || Number(value.current_index) < 0 || Number(value.current_index) >= session.questions.length) throw new Error("Choose a question in this session.");
  if (value.status !== "active" && value.status !== "complete") throw new Error("Invalid session status.");
  if (!value.answers || typeof value.answers !== "object" || Array.isArray(value.answers)) throw new Error("Invalid answers.");
  const answers: Record<string, PracticeAnswer> = {};
  for (const [id, record] of Object.entries(value.answers)) {
    const question = session.questions.find(q => q.id === id);
    if (!question || !record || typeof record !== "object" || Array.isArray(record)) throw new Error("An answer does not belong to this session.");
    const a = record as Record<string, unknown>;
    if (typeof a.answer !== "string" || a.answer.length > 12000 || typeof a.code !== "string" || a.code.length > 10000 || (!question.coding && a.code)) throw new Error("Answer or code exceeds its limit.");
    if (!Array.isArray(a.checks) || a.checks.length > question.evaluationCriteria.length || a.checks.some(c => typeof c !== "boolean") || typeof a.reviewed !== "boolean") throw new Error("Invalid self-review.");
    if (a.reviewed && (!a.answer.trim() || a.checks.length !== question.evaluationCriteria.length)) throw new Error("Attempt the answer and review every criterion first.");
    answers[id] = { answer: a.answer, code: a.code, checks: a.checks, reviewed: a.reviewed };
  }
  if (value.status === "complete" && session.questions.some(q => !answers[q.id]?.reviewed)) throw new Error("Attempt and self-review every question before finishing.");
  return { answers, current_index: Number(value.current_index), status: value.status as PracticeSession["status"] };
}

export function reviewSummary(session: Pick<PracticeSession, "questions" | "answers">) {
  const reviewed = session.questions.filter(q => session.answers[q.id]?.reviewed);
  const total = reviewed.reduce((n, q) => n + q.evaluationCriteria.length, 0);
  const checked = reviewed.reduce((n, q) => n + session.answers[q.id].checks.filter(Boolean).length, 0);
  const weak = reviewed.filter(q => session.answers[q.id].checks.some(c => !c));
  return { reviewed: reviewed.length, checked, total, percent: total ? Math.round(checked / total * 100) : null, weak };
}

export function remainingSeconds(createdAt: string, minutes: number, now: number) {
  if (!Number.isFinite(Date.parse(createdAt)) || !Number.isFinite(now) || ![10,20,30].includes(minutes)) return 0;
  return Math.max(0, Math.ceil((Date.parse(createdAt) + minutes * 60000 - now) / 1000));
}
