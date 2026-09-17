import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import { randomUUID } from "node:crypto";
import ts from "typescript";
import { learningPaths, recommendPaths } from "./catalog.ts";
import * as model from "./model.ts";
import { completionHtml } from "./certificate.ts";
import { getResumeSkills } from "../matching/scorer.ts";
import { studioLesson, studioVideoUrl, playbackSeconds, timestamp } from "./studio.ts";

function load(file, dependencies) {
  const loadedModule = new Module(import.meta.filename);
  loadedModule.require = (name) => {
    if (name === "server-only") return {};
    if (Object.hasOwn(dependencies, name)) return dependencies[name];
    throw Error("Unexpected dependency " + name);
  };
  loadedModule._compile(ts.transpileModule(readFileSync(new URL(file, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, import.meta.filename);
  return loadedModule.exports;
}
const assessment = load("./assessment.ts", {});
const path = learningPaths[0];

test("learning does not invent a course match for unsupported profiles", () => {
  for (const role of ["Recruiter", "Accountant", "Mechanical Engineer", "Sales Manager", "Research Nurse"]) {
    assert.deepEqual(recommendPaths(["Negotiation"], role, []), []);
  }
  assert.deepEqual(recommendPaths([], "", []), []);
  assert.ok(recommendPaths(["SQL"], "Financial Analyst", []).every(item => learningPaths.find(path => path.id === item.pathId).skills.includes("SQL")));
});

test("every lesson has original in-app learning and only approved players accept safe origins", () => {
  for (const path of learningPaths) for (const lesson of path.lessons) {
    const content = studioLesson(path.id, lesson.id);
    assert.ok(content, `${path.id}/${lesson.id} needs an internal reading route`);
    assert.ok(content.outcome.length > 30 && content.explanation.length >= 2);
    assert.ok(content.example && content.walkthrough && content.mistake && content.reflection && content.answer);
    assert.equal(Object.hasOwn(content, "html"), false, "lessons are plain strings, not untrusted HTML");
    if (lesson.embedUrl) {
      const player = new URL(studioVideoUrl(lesson.embedUrl, "https://jobpilot.example/learn"));
      assert.equal(player.searchParams.get("origin"), "https://jobpilot.example");
      assert.equal(player.searchParams.get("enablejsapi"), "1");
      assert.equal(player.searchParams.has("autoplay"), false);
    }
  }
  for (const bad of ["https://evil.example/embed/pQN-pnXPaVg", "https://www.youtube-nocookie.com/embed/unapproved", "https://user@www.youtube-nocookie.com/embed/pQN-pnXPaVg", "http://www.youtube-nocookie.com/embed/pQN-pnXPaVg"]) assert.throws(() => studioVideoUrl(bad, "https://jobpilot.example"));
  assert.throws(() => studioVideoUrl("https://www.youtube-nocookie.com/embed/pQN-pnXPaVg", "javascript:alert(1)"));
  for (const bad of [NaN, Infinity, -1, 86401, "12"]) assert.equal(playbackSeconds(bad), 0);
  assert.equal(playbackSeconds(125.8), 125);
  assert.equal(timestamp(125), "2:05");
});

test("catalogue has coherent free routes, safe optional embeds and original server-only checks", () => {
  assert.equal(learningPaths.length, 7);
  assert.equal(new Set(learningPaths.map((path) => path.id)).size, 7);
  for (const path of learningPaths) {
    assert.equal(new Set(path.lessons.map((lesson) => lesson.id)).size, path.lessons.length);
    assert.equal(assessment.assessmentQuestions(path.id).length, 3);
    assert.ok(assessment.assessmentQuestions(path.id).every((question) => !Object.hasOwn(question, "correct")));
    for (const lesson of path.lessons) {
      assert.equal(new URL(lesson.url).protocol, "https:");
      assert.equal(new URL(lesson.alternative).protocol, "https:");
      if (lesson.embedUrl) assert.equal(new URL(lesson.embedUrl).hostname, "www.youtube-nocookie.com");
      assert.match(lesson.access, /Free/);
    }
  }
  const recommendations = recommendPaths(["React", "JavaScript"], "Frontend Engineer", [{ title: "Frontend Developer", skills: ["TypeScript"] }, { title: "Finance Analyst", skills: ["SQL"] }]);
  assert.equal(recommendations[0].pathId, "javascript-typescript");
  assert.match(recommendations[0].reason, /1 of 1/);
  assert.ok(recommendPaths([], "", []).every((item) => !item.reason.includes("sampled")));
  assert.throws(() => assessment.gradeAssessment(path.id, [1, 0, 9]));
  assert.throws(() => assessment.gradeAssessment(path.id, [, 0, 2]));
  assert.equal(assessment.gradeAssessment(path.id, [1, 0, 2]).score, 100);
});

test("progress, evidence and provider credentials validate their trust boundaries", () => {
  const { version, updated_at, path_id, ...progress } = model.initialEnrollment(path);
  void version; void updated_at; void path_id;
  assert.deepEqual(model.parseProgress(progress, path), progress);
  for (const bad of [{ ...progress, score: 100 }, { ...progress, completed: ["other-path"] }, { ...progress, bookmarks: ["html", "html"] }, { ...progress, notes: { html: "x".repeat(2001) } }, { ...progress, minutes_per_day: 0 }, { ...progress, project_url: "https://127.0.0.1/a" }, { ...progress, project_url: "https://u:p@example.com" }]) assert.throws(() => model.parseProgress(bad, path));
  const enrolled = { ...model.initialEnrollment(path), completed: path.lessons.map((lesson) => lesson.id), project_url: "https://github.com/example/learning", project_summary: "I built a semantic responsive page and checked keyboard navigation and narrow-screen overflow." };
  assert.equal(model.certificateEligible(path, enrolled, 67), true);
  assert.equal(model.certificateEligible(path, enrolled, 33), false);
  assert.equal(model.certificateEligible(path, { ...enrolled, completed: [] }, 100), false);
  const credential = { title: "CS50 Certificate", issuer: "CS50", issued_on: "2026-01-01", expires_on: "", verification_url: "https://certificates.cs50.io/example", credential_ref: "example", confirmed: true };
  assert.equal(model.parseExternalCredential(credential).expires_on, null);
  for (const bad of [{ ...credential, confirmed: false }, { ...credential, issuer: "JobPilot" }, { ...credential, issued_on: "2026-02-30" }, { ...credential, issued_on: "2026-13-01" }, { ...credential, expires_on: "2025-01-01" }, { ...credential, verification_url: "javascript:alert(1)" }]) assert.throws(() => model.parseExternalCredential(bad));
  assert.match(model.resumeEvidence(enrolled, path), /not employment experience/);
  const html = completionHtml({ id: randomUUID(), title: "<script>alert(1)</script>", issued_on: "2026-01-01", is_public: false }, "<img onerror=evil>", "https://jobpilot.example/verify");
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img"));
  assert.match(html, /Private record/);
});

let db;
let adminCalls = 0;
const route = load("../../app/api/learn/route.ts", {
  "@/lib/supabase/server": { createClient: async () => db.client },
  "@/lib/learning/server": { learningAdmin: () => { adminCalls++; return db.admin; } },
  "@/lib/learning/catalog": { findLearningPath: (id) => learningPaths.find((path) => path.id === id), recommendPaths },
  "@/lib/learning/assessment": assessment,
  "@/lib/learning/model": model,
  "@/lib/matching/scorer": { getResumeSkills },
});
const download = load("../../app/api/learn/certificate/route.ts", {
  "@/lib/supabase/server": { createClient: async () => db.client },
  "@/lib/learning/certificate": { completionHtml },
  "@/lib/learning/model": model,
  "@/lib/site-url": { getSiteUrl: () => "https://jobpilot.example" },
});

function database(user = "owner", error = null) {
  const rows = { skillpath_enrollments: [], skillpath_attempts: [], skillpath_credentials: [], profiles: [{ id: "owner", target_role: "Frontend Engineer", full_name: "Sample Learner" }], resumes: [], jobs: [] };
  const from = (admin) => (table) => {
    const filters = [];
    let operation = "read", value, columns = "*", head = false, count = false, limit = Infinity, sort;
    const query = {
      select(fields = "*", options = {}) { columns = fields; head = Boolean(options.head); count = Boolean(options.count); return query; },
      eq(key, expected) { filters.push((row) => row[key] === expected); return query; },
      is(key, expected) { filters.push((row) => row[key] === expected); return query; },
      gte(key, expected) { filters.push((row) => row[key] >= expected); return query; },
      order(key, options) { sort = { key, ascending: options.ascending }; return query; },
      limit(size) { limit = size; return query; },
      insert(row) { operation = "insert"; value = row; return query; },
      update(row) { operation = "update"; value = row; return query; },
      delete() { operation = "delete"; return query; },
      then(resolve, reject) { return Promise.resolve(execute()).then(resolve, reject); },
      maybeSingle: async () => execute(true),
      single: async () => execute(true),
    };
    function execute(single = false) {
      if (error && table.startsWith("skillpath_")) return { data: null, error, count: null };
      if (!admin && operation !== "read") return { data: null, error: { code: "42501" } };
      let selected = rows[table].filter((row) => filters.every((filter) => filter(row)) && (admin || !table.startsWith("skillpath_") || row.user_id === user));
      if (operation === "insert") {
        assert.equal(value.user_id, user, "owner comes from verified session, never from request");
        if (rows[table].some((row) => value.id && row.id === value.id || table === "skillpath_enrollments" && row.user_id === value.user_id && row.path_id === value.path_id || table === "skillpath_credentials" && value.path_id && row.user_id === value.user_id && row.path_id === value.path_id)) return { data: null, error: { code: "23505" } };
        const row = { id: randomUUID(), created_at: new Date().toISOString(), public_name: "", is_public: false, revoked_at: null, expires_on: null, verification_url: "", credential_ref: "", path_id: null, ...value };
        rows[table].push(row); selected = [row];
      }
      if (operation === "update") selected.forEach((row) => Object.assign(row, value));
      if (operation === "delete") rows[table] = rows[table].filter((row) => !selected.includes(row));
      if (sort) selected.sort((a, b) => (a[sort.key] > b[sort.key] ? 1 : -1) * (sort.ascending ? 1 : -1));
      const total = selected.length;
      selected = selected.slice(0, limit).map((row) => columns === "*" ? { ...row } : Object.fromEntries(columns.split(",").map((key) => [key, row[key]])));
      return { data: head ? null : single ? selected[0] || null : selected, error: null, count: count ? total : null };
    }
    return query;
  };
  return { rows, client: { auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) }, from: from(false) }, admin: { from: from(true) } };
}
const request = (body, origin = "https://jobpilot.example") => new Request("https://jobpilot.example/api/learn", { method: "POST", headers: { "Content-Type": "application/json", Origin: origin }, body: JSON.stringify(body) });

test("learning APIs enforce session ownership, stale writes, assessment eligibility, idempotency and sharing", async () => {
  const oldKey = process.env.SUPABASE_SECRET_KEY;
  process.env.SUPABASE_SECRET_KEY = "test-only";
  try {
    db = database(null); adminCalls = 0;
    assert.equal((await route.GET(new Request("https://jobpilot.example/api/learn"))).status, 401);
    assert.equal((await route.POST(request({ action: "enroll", pathId: path.id }))).status, 401);
    assert.equal(adminCalls, 0);
    db = database();
    assert.equal((await route.POST(request({ action: "enroll", pathId: path.id }, "https://other.example"))).status, 403);
    assert.equal((await route.POST(request({ action: "enroll", pathId: path.id, user_id: "other" }))).status, 200);
    assert.equal((await route.POST(request({ action: "enroll", pathId: path.id }))).status, 200);
    assert.equal(db.rows.skillpath_enrollments.length, 1);
    assert.equal((await route.POST(request({ action: "issue", pathId: path.id, confirmed: true }))).status, 400);
    const { version, updated_at, path_id, user_id, id, created_at, ...raw } = db.rows.skillpath_enrollments[0];
    void updated_at; void path_id; void user_id; void id; void created_at;
    const progress = Object.fromEntries(["completed", "bookmarks", "notes", "selected_lesson", "minutes_per_day", "target_role", "project_url", "project_summary"].map((key) => [key, raw[key]]));
    const payload = { action: "save", pathId: path.id, version, progress: { ...progress, completed: path.lessons.map((lesson) => lesson.id), project_url: "https://github.com/example/project", project_summary: "I built an accessible responsive page and checked its keyboard focus and mobile layout." } };
    assert.equal((await route.POST(request({ ...payload, progress: { ...payload.progress, score: 100 } }))).status, 400);
    assert.equal((await route.POST(request(payload))).status, 200);
    assert.equal((await route.POST(request(payload))).status, 409);
    const attemptRequest = { action: "assess", pathId: path.id, answers: [1, 0, 2], requestId: randomUUID() };
    assert.equal((await route.POST(request({ ...attemptRequest, answers: [5] }))).status, 400);
    assert.equal((await route.POST(request(attemptRequest))).status, 200);
    assert.equal((await (await route.POST(request({ ...attemptRequest, answers: [0, 0, 0] }))).json()).score, 100);
    assert.equal(db.rows.skillpath_attempts.length, 1);
    const issue = { action: "issue", pathId: path.id, confirmed: true };
    assert.equal((await route.POST(request({ ...issue, confirmed: false }))).status, 400);
    const issued = await (await route.POST(request(issue))).json();
    assert.equal(issued.credential.is_public, false);
    assert.equal((await route.POST(request(issue))).status, 200);
    assert.equal(db.rows.skillpath_credentials.length, 1);
    const foreign = { ...issued.credential, id: randomUUID(), user_id: "other" };
    db.rows.skillpath_credentials.push(foreign);
    assert.equal((await route.POST(request({ action: "share", id: foreign.id, enabled: true, publicName: "Wrong" }))).status, 404);
    assert.equal((await route.POST(request({ action: "revoke", id: foreign.id }))).status, 404);
    assert.equal((await download.GET(new Request(`https://jobpilot.example/api/learn/certificate?id=${foreign.id}`))).status, 404);
    const shared = await route.POST(request({ action: "share", id: issued.credential.id, enabled: true, publicName: "Sample Public Name" }));
    assert.equal(shared.status, 200);
    const certificate = await download.GET(new Request(`https://jobpilot.example/api/learn/certificate?id=${issued.credential.id}`));
    assert.equal(certificate.status, 200);
    assert.match(certificate.headers.get("Content-Security-Policy"), /default-src 'none'/);
    assert.match(await certificate.text(), /Sample Public Name/);
    assert.equal((await route.POST(request({ action: "share", id: issued.credential.id, enabled: false, publicName: "" }))).status, 200);
    assert.equal((await route.POST(request({ action: "revoke", id: issued.credential.id }))).status, 200);
    assert.equal((await download.GET(new Request(`https://jobpilot.example/api/learn/certificate?id=${issued.credential.id}`))).status, 404);
    const loaded = await (await route.GET(new Request(`https://jobpilot.example/api/learn?path=${path.id}`))).json();
    assert.equal(loaded.credentials.length, 1);
    assert.ok(loaded.questions.every((question) => !Object.hasOwn(question, "correct")));
    db = database("owner", { code: "42P01" });
    assert.equal((await (await route.GET(new Request("https://jobpilot.example/api/learn"))).json()).storageReady, false);
    assert.equal((await route.POST(request({ action: "enroll", pathId: path.id }))).status, 503);
    delete process.env.SUPABASE_SECRET_KEY;
    db = database();
    assert.equal((await route.POST(request({ action: "enroll", pathId: path.id }))).status, 503);
  } finally {
    if (oldKey === undefined) delete process.env.SUPABASE_SECRET_KEY; else process.env.SUPABASE_SECRET_KEY = oldKey;
  }
});
