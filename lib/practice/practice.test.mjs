import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import * as model from "./model.ts";
import { getResumeSkills } from "../matching/scorer.ts";
import { blankAnswer, buildQuestions, parseProgress, parseSetup, remainingSeconds, reviewSummary, topics, validId } from "./model.ts";

const setup = { topic: "javascript", mode: "technical", minutes: 10, role: "Frontend Engineer" };
const session = () => ({ ...parseSetup(setup), questions: buildQuestions("javascript", setup.role, "technical", 10), answers: {}, current_index: 0, status: "active" });

test("role-driven practice supports unrelated professions without injected frontend skills", () => {
  for (const [role, skills] of [["Accountant", ["Financial reporting", "Tax compliance"]], ["Recruiter", ["Candidate sourcing", "Interviewing"]], ["Mechanical Engineer", ["CAD", "Thermodynamics"]], ["Sales Manager", ["Negotiation", "Forecasting"]], ["Research Nurse", ["Clinical research", "Patient care"]]]) {
    const questions = buildQuestions("role", role, "technical", 30, skills);
    assert.ok(skills.every(skill => questions.some(question => question.focusArea === skill)));
    assert.ok(questions.every(question => !question.learningPath));
    assert.doesNotMatch(JSON.stringify(questions), /React|TypeScript|codebase|architecture/);
    assert.match(questions[0].question, new RegExp(role));
  }
  const unknown = buildQuestions("role", "My custom profession", "technical", 10);
  assert.match(unknown[0].question, /My custom profession/);
  assert.doesNotMatch(JSON.stringify(unknown), /architecture|React/);
  assert.equal(parseSetup({ ...setup, topic: "role", role: "Accountant" }).role, "Accountant");
  const finance = buildQuestions("role", "Investment Analyst", "technical", 20, ["Capital markets", "Interest rate analysis"]);
  assert.doesNotMatch(JSON.stringify(finance), /API design|Authentication|React/);
});

test("all topic/mode combinations offer unique original practice and bounded sessions", () => {
  for (const topic of Object.keys(topics)) for (const mode of ["technical", "behavioral", "mixed"]) for (const minutes of [10,20,30]) {
    const q = buildQuestions(topic, "Engineer", mode, minutes);
    assert.ok(q.length > 0 && q.length <= 7);
    assert.equal(new Set(q.map(q => q.id)).size, q.length);
    assert.ok(q.every(q => q.evaluationCriteria.length > 0));
    if (mode === "technical") assert.ok(q.every(q => q.category === "technical"));
    if (mode === "behavioral") assert.ok(q.every(q => ["behavioral", "hr"].includes(q.category)));
  }
  assert.ok(session().questions.some(q => q.coding?.cases.length));
});

test("setup and progress reject oversized, foreign and forged review data", () => {
  for (const patch of [{ topic: "__proto__" }, { minutes: "10" }, { role: " " }, { role: "x".repeat(121) }, { mode: "paid" }]) assert.throws(() => parseSetup({ ...setup, ...patch }));
  const s = session(); const id = s.questions[0].id;
  const progress = { answers: { [id]: blankAnswer() }, current_index: 0, status: "active" };
  assert.deepEqual(parseProgress(progress, s), progress);
  for (const patch of [{ answers: { alien: blankAnswer() } }, { current_index: 99 }, { current_index: -1 }, { status: "complete" }, { answers: { [id]: { ...blankAnswer(), answer: "x".repeat(12001) } } }, { answers: { [id]: { ...blankAnswer(), reviewed: true } } }, { answers: { [id]: { ...blankAnswer(), checks: ["yes"] } } }]) assert.throws(() => parseProgress({ ...progress, ...patch }, s));
});

test("completed reviews use only self-reported checks and identify retry questions", () => {
  const s = session();
  const answers = Object.fromEntries(s.questions.map((q, i) => [q.id, { ...blankAnswer(), answer: "My own attempt", reviewed: true, checks: q.evaluationCriteria.map(() => i !== 0) }]));
  const progress = parseProgress({ answers, current_index: 2, status: "complete" }, s);
  const result = reviewSummary({ ...s, ...progress });
  assert.equal(result.reviewed, 3); assert.equal(result.weak.length, 1);
  assert.equal(result.weak[0].id, s.questions[0].id);
  assert.ok(result.percent > 0 && result.percent < 100);
  assert.equal(reviewSummary(s).percent, null);
});

test("timer expiration clamps without changing answers and IDs are strict", () => {
  const s = session();
  assert.equal(remainingSeconds("2026-09-17T00:00:00Z", 10, Date.parse("2026-09-17T00:05:00Z")), 300);
  assert.equal(remainingSeconds("2026-09-17T00:00:00Z", 10, Date.parse("2026-09-17T00:30:00Z")), 0);
  assert.equal(remainingSeconds("invalid", 10, Date.now()), 0);
  assert.deepEqual(s.answers, {});
  assert.equal(validId("00000000-0000-4000-8000-000000000001"), true);
  assert.equal(validId("00000000-0000-0000-0000-000000000001"), false);
});

test("practice routes enforce authentication, ownership, idempotency and stale-write protection", async () => {
  let owner = "owner"; let adminCalls = 0; const rows = [];
  const from = table => {
    if (table === "resumes") { const query = { select: () => query, eq: () => query, order: () => query, limit: () => query, maybeSingle: async () => ({ data: null, error: null }) }; return query; }
    if (table === "jobs") { let id; const query = { select: () => query, eq: (_,v) => { id = v; return query; }, maybeSingle: async () => ({ data: id === "job-1" ? { title: "Verified source role", skills: ["React"], description: "<p>Build an accessible search screen.</p>" } : null, error: null }) }; return query; }
    assert.equal(table, "interview_practice_sessions");
    const filters = []; let operation = "read", value;
    const execute = () => {
      let selected = rows.filter(row => filters.every(([k, v]) => row[k] === v));
      if (operation === "insert") { assert.equal(value.user_id, owner); const row = { answers: {}, current_index: 0, status: "active", version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...value }; rows.push(row); selected = [row]; }
      if (operation === "update") selected.forEach(row => Object.assign(row, value));
      if (operation === "delete") selected.forEach(row => rows.splice(rows.indexOf(row), 1));
      return { data: selected[0] ? { ...selected[0] } : null, error: null, count: selected.length };
    };
    const query = { select: () => query, eq: (k,v) => { filters.push([k,v]); return query; }, insert: v => { operation = "insert"; value = v; return query; }, update: v => { operation = "update"; value = v; return query; }, delete: () => { operation = "delete"; return query; }, maybeSingle: async () => execute(), single: async () => execute(), then: (resolve,reject) => Promise.resolve(execute()).then(resolve,reject) };
    return query;
  };
  const client = { auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null } }) }, from };
  const dependencies = { "@/lib/supabase/server": { createClient: async () => client }, "@/lib/learning/server": { learningAdmin: () => { adminCalls++; return { from }; } }, "@/lib/matching/scorer": { getResumeSkills }, "@/lib/practice/model": model };
  const loaded = new Module(import.meta.filename);
  loaded.require = name => { assert.ok(Object.hasOwn(dependencies,name)); return dependencies[name]; };
  loaded._compile(ts.transpileModule(readFileSync(new URL("../../app/api/practice/route.ts", import.meta.url),"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, import.meta.filename);
  const route = loaded.exports;
  const request = (body, origin = "https://jobpilot.test") => new Request("https://jobpilot.test/api/practice", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(body) });
  const id = randomUUID(); const create = { action: "create", id, ...setup, user_id: "other" };
  owner = ""; assert.equal((await route.POST(request(create))).status, 401); assert.equal(adminCalls, 0);
  owner = "owner";
  assert.equal((await route.POST(request(create,"https://evil.test"))).status, 403); assert.equal(adminCalls, 0);
  assert.equal((await route.POST(request(create))).status, 200);
  assert.equal((await route.POST(request(create))).status, 200); assert.equal(rows.length, 1);
  const answers = Object.fromEntries(rows[0].questions.map(q => [q.id, { ...blankAnswer(), answer: "Own attempt", checks: q.evaluationCriteria.map(() => false), reviewed: true }]));
  const save = { action: "save", id, version: 1, answers, current_index: 0, status: "complete" };
  assert.equal((await route.POST(request(save))).status, 200);
  assert.equal((await route.POST(request(save))).status, 409);
  owner = "other";
  assert.equal((await route.GET(new Request(`https://jobpilot.test/api/practice?id=${id}`))).status, 404);
  assert.equal((await route.POST(request({ action: "delete", id }))).status, 404); assert.equal(rows.length, 1);
  owner = "owner";
  const retry = await (await route.POST(request({ ...create, id: randomUUID(), retryId: id }))).json();
  assert.equal(retry.session.questions.length, 3);
  assert.equal((await route.POST(request({ action: "delete", id }))).status, 200);
  assert.equal(rows.length, 1);
  assert.equal((await route.POST(request({ ...create, id: randomUUID(), padding: "x".repeat(700001) }))).status, 413);
  const jobSession = await (await route.POST(request({ ...create, id: randomUUID(), jobId: "job-1" }))).json();
  assert.equal(jobSession.session.role, "Verified source role");
  assert.equal(jobSession.session.questions[0].id, "job-scenario");
  assert.equal(jobSession.session.questions[0].jobContext, "Build an accessible search screen.");
  assert.equal((await route.POST(request({ ...create, id: randomUUID(), jobId: "missing" }))).status, 404);
});
