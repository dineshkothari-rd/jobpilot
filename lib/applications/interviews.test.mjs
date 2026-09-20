import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import * as model from "./interviews.ts";
import { homeDayActions } from "../home-next-action.ts";

const id = "12345678-1234-4234-8234-123456789012";
const applicationId = "12345678-1234-4234-8234-123456789013";
const draft = { id, application_id: applicationId, round: "Portfolio review", local_time: "2026-10-01T09:30", timezone: "Asia/Kolkata", duration_minutes: 60, location: "Office", notes: "Prepare examples", status: "scheduled", outcome: "", version: 0 };

test("interview dates handle timezone offsets and reject invalid or ambiguous local times", () => {
  assert.equal(model.interviewInstant(draft.local_time, draft.timezone), "2026-10-01T04:00:00.000Z");
  assert.equal(model.interviewInstant("2026-10-01T09:30", "Asia/Kathmandu"), "2026-10-01T03:45:00.000Z");
  assert.equal(model.interviewInstant("2026-07-01T09:30", "America/New_York"), "2026-07-01T13:30:00.000Z");
  for (const [local, zone] of [["2026-03-08T02:30", "America/New_York"], ["2026-11-01T01:30", "America/New_York"], ["2026-02-30T09:30", "UTC"], [draft.local_time, "bad"]]) assert.throws(() => model.interviewInstant(local, zone));
  for (const changes of [{ user_id: "other" }, { duration_minutes: 4 }, { status: "applied" }, { version: -1 }, { notes: "a".repeat(5001) }]) assert.throws(() => model.parseInterview({ ...draft, ...changes }));
});

test("calendar export escapes content, folds Unicode and uses exact UTC event time", () => {
  const event = { ...model.parseInterview(draft), version: 1, notes: "中文".repeat(100) + "\r\nEND:VEVENT;evil,content" };
  const calendar = model.interviewCalendar(event, "Designer", new Date("2026-09-18T00:00:00Z"));
  assert.match(calendar, /DTSTART:20261001T040000Z/);
  assert.match(calendar, /DTEND:20261001T050000Z/);
  assert.match(calendar, /SEQUENCE:1/);
  assert.ok(calendar.replace(/\r\n /g, "").includes("\\nEND:VEVENT\\;evil\\,content"));
  assert.equal(calendar.match(/\r\nEND:VEVENT/g).length, 1);
  for (const line of calendar.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75);
  assert.match(model.interviewCalendar({ ...event, status: "cancelled" }, "Designer"), /STATUS:CANCELLED/);
});

test("Home prioritizes real interview rounds, suppresses duplicates and asks for overdue outcomes", () => {
  const event = { ...model.parseInterview(draft), version: 1 };
  const input = { now: Date.parse("2026-09-18T00:00:00Z"), needsSetup: false, hasResume: true, hasMatches: true, continuations: [], interviews: [event], applications: [{ id: applicationId, job_id: "job", job_title: "Designer", status: "interview", follow_up_at: "2026-09-17T00:00:00Z" }] };
  const before = JSON.stringify(input);
  const actions = homeDayActions(input);
  assert.match(actions[0].title, /Prepare for your interview/);
  assert.equal(actions.filter(a => a.href === "/applications?jobId=job").length, 1);
  assert.match(homeDayActions({ ...input, now: Date.parse("2026-10-02T00:00:00Z") })[0].title, /Record your interview outcome/);
  assert.match(homeDayActions({ ...input, needsSetup: true })[0].title, /interview/);
  assert.equal(homeDayActions({ ...input, interviews: [{ ...event, status: "cancelled" }] })[0].title, "Follow up: Designer");
  assert.equal(JSON.stringify(input), before);
});

test("interview API enforces login, application ownership, bounded input and stale-write protection", async () => {
  let owner = "", missing = false;
  const rows = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null } }) },
    from: table => {
      let operation = "read", value; const filters = [];
      const execute = () => {
        if (missing) return { error: { code: "42P01" } };
        if (table === "applications") return { data: owner === "owner" ? { id: applicationId } : null };
        assert.equal(table, "application_interviews");
        const selected = rows.filter(row => filters.every(([k, v]) => row[k] === v));
        assert.ok(filters.some(([k, v]) => k === "user_id" && v === owner) || operation === "insert");
        if (operation === "insert") { if (rows.some(row => row.id === value.id)) return { error: { code: "23505" } }; assert.equal(value.user_id, owner); rows.push(value); return { data: structuredClone(value) }; }
        if (operation === "update") selected.forEach(row => Object.assign(row, value));
        return { data: structuredClone(selected[0] || null) };
      };
      const query = { select: () => query, eq: (k,v) => { filters.push([k,v]); return query; }, insert: v => { operation = "insert"; value = v; return query; }, update: v => { operation = "update"; value = v; return query; }, order: () => query, limit: async () => { const result = execute(); return { ...result, data: result.data ? [result.data] : [] }; }, single: async () => execute(), maybeSingle: async () => execute() };
      return query;
    },
  };
  const loaded = new Module(import.meta.filename);
  loaded.require = name => name === "@/lib/supabase/server" ? { createClient: async () => client } : model;
  loaded._compile(ts.transpileModule(readFileSync(new URL("../../app/api/interviews/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, import.meta.filename);
  const route = loaded.exports;
  const request = (body, origin = "https://jobpilot.test") => new Request("https://jobpilot.test/api/interviews", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(body) });
  assert.equal((await route.POST(request(draft))).status, 401);
  assert.equal((await route.GET(new Request("https://jobpilot.test/api/interviews"))).status, 401);
  owner = "owner";
  assert.equal((await route.POST(request(draft, "https://evil.test"))).status, 403);
  assert.equal((await route.POST(request({ ...draft, user_id: "other" }))).status, 400);
  assert.equal((await route.POST(request({ notes: "a".repeat(32769) }))).status, 413);
  assert.equal((await route.POST(request(draft))).status, 200);
  assert.equal((await route.POST(request(draft))).status, 409);
  assert.equal((await route.POST(request({ ...draft, version: 1, status: "completed", outcome: "Second round invited" }))).status, 200);
  assert.equal((await route.POST(request({ ...draft, version: 1 }))).status, 409);
  owner = "other";
  assert.equal((await route.POST(request({ ...draft, version: 2 }))).status, 404);
  assert.equal(rows[0].status, "completed");
  missing = true;
  assert.equal((await route.GET(new Request("https://jobpilot.test/api/interviews"))).status, 503);
});
