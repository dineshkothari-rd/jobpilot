import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import * as model from "./home-next-action.ts";
import { dayKeyValid, homeContinuations, homeDayActions, homeNextAction, parseDayPreferences, splitDayActions, updateDayPreference } from "./home-next-action.ts";

test("home prioritizes setup, resume, due follow-up and prepared application before job discovery", () => {
  const input = { needsSetup: true, hasResume: false, dueJobId: "due/job", readyJobId: "ready/job", hasMatches: true };
  assert.equal(homeNextAction(input).href, "/profile");
  input.needsSetup = false;
  assert.equal(homeNextAction(input).href, "/resume");
  input.hasResume = true;
  assert.equal(homeNextAction(input).href, "/applications?jobId=due%2Fjob");
  delete input.dueJobId;
  assert.equal(homeNextAction(input).href, "/applications?jobId=ready%2Fjob");
  delete input.readyJobId;
  assert.equal(homeNextAction(input).cta, "Review job matches");
  input.hasMatches = false;
  assert.equal(homeNextAction(input).cta, "Find jobs");
});

test("planning API authenticates, scopes writes, rejects stale tabs and bounds input", async () => {
  let owner = "", missing = false;
  const rows = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null } }) },
    from: table => {
      assert.equal(table, "my_day_preferences");
      let operation = "read", value; const filters = [];
      const execute = () => {
        if (missing) return { data: null, error: { code: "42P01" } };
        let selected = rows.filter(row => filters.every(([key, val]) => row[key] === val));
        if (operation === "insert") { assert.equal(value.user_id, owner); rows.push({ ...value }); selected = [value]; }
        if (operation === "update") { assert.ok(filters.some(([k,v]) => k === "user_id" && v === owner)); selected.forEach(row => Object.assign(row, value)); }
        return { data: selected[0] ? structuredClone(selected[0]) : null, error: null };
      };
      const query = { select: () => query, eq: (k,v) => { filters.push([k,v]); return query; }, insert: v => { operation = "insert"; value = v; return query; }, update: v => { operation = "update"; value = v; return query; }, single: async () => execute(), maybeSingle: async () => execute() };
      return query;
    },
  };
  const loaded = new Module(import.meta.filename);
  loaded.require = id => {
    if (id === "@/lib/supabase/server") return { createClient: async () => client };
    assert.equal(id, "@/lib/home-next-action"); return model;
  };
  loaded._compile(ts.transpileModule(readFileSync(new URL("../app/api/my-day/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, import.meta.filename);
  const route = loaded.exports;
  const request = (body, origin = "https://jobpilot.test") => new Request("https://jobpilot.test/api/my-day", { method: "POST", headers: { Origin: origin }, body: JSON.stringify(body) });
  const body = { key: "/jobs", until: new Date(Date.now() + 86400000).toISOString(), version: 0 };
  assert.equal((await route.GET()).status, 401);
  assert.equal((await route.POST(request(body))).status, 401);
  owner = "owner";
  assert.deepEqual((await (await route.GET()).json()).preferences, {});
  assert.equal((await route.POST(request(body, "https://evil.test"))).status, 403);
  const crossSite = request(body); crossSite.headers.set("sec-fetch-site", "cross-site");
  assert.equal((await route.POST(crossSite)).status, 403);
  assert.equal((await route.POST(request({ ...body, user_id: "other" }))).status, 400);
  assert.equal((await route.POST(request({ ...body, key: "https://evil.test" }))).status, 400);
  assert.equal((await route.POST(request(body))).status, 200);
  assert.equal((await route.POST(request(body))).status, 409);
  assert.equal((await route.POST(request({ ...body, version: 1, until: null }))).status, 200);
  assert.deepEqual(rows[0].preferences, {});
  owner = "other";
  assert.deepEqual((await (await route.GET()).json()).preferences, {});
  assert.equal((await route.POST(request({ ...body, version: 2 }))).status, 409);
  assert.equal(rows[0].version, 2);
  assert.equal((await route.POST(request({ padding: "x".repeat(4097) }))).status, 413);
  missing = true;
  assert.equal((await route.GET()).status, 503);
  assert.equal((await route.POST(request(body))).status, 503);
});

test("daily priorities, deferral expiry and undo never mutate application progress", () => {
  const now = Date.parse("2026-09-17T12:00:00Z");
  const applications = [
    { job_id: "ready", job_title: "React role", status: "saved", follow_up_at: null, application_package: { status: "prepared" } },
    { job_id: "closed", status: "rejected", follow_up_at: "2026-09-16T12:00:00Z" },
    { job_id: "due", status: "applied", follow_up_at: "2026-09-16T12:00:00Z" },
  ];
  const input = { needsSetup: false, hasResume: true, hasMatches: true, applications, now, continuations: [] };
  const before = JSON.stringify(input);
  const actions = homeDayActions(input);
  assert.deepEqual(actions.map(a => a.href), ["/applications?jobId=due", "/applications?jobId=ready", "/jobs"]);
  const until = new Date(now + 86400000).toISOString();
  const preferences = updateDayPreference({}, actions[0].href, until, now);
  assert.equal(splitDayActions(actions, preferences, now).active[0].href, actions[1].href);
  assert.equal(splitDayActions(actions, preferences, now).deferred[0].href, actions[0].href);
  assert.equal(splitDayActions(actions, preferences, now + 86400000).active[0].href, actions[0].href);
  assert.deepEqual(updateDayPreference(preferences, actions[0].href, null, now), {});
  assert.equal(JSON.stringify(input), before);
  assert.equal(homeDayActions({ ...input, needsSetup: true })[0].href, "/profile");
  for (const key of ["/profile", "/resume", "https://evil.test", "//evil.test", "/learn/../x", "/applications?jobId=../x"]) assert.equal(dayKeyValid(key), false);
  for (const value of [null, [], { "/jobs": "invalid" }, { "/profile": until }]) assert.throws(() => parseDayPreferences(value));
  for (const time of ["invalid", new Date(now).toISOString(), new Date(now + 31 * 86400000).toISOString()]) assert.throws(() => updateDayPreference({}, "/jobs", time, now));
});

test("My Day uses newest unfinished saved work and safe exact internal destinations", () => {
  const id = "12345678-1234-4234-8234-123456789012";
  const enrollment = { path_id: "react-workflows", completed: ["react"], selected_lesson: "state", updated_at: "2026-09-17T12:00:00Z" };
  const learning = { storageReady: true, paths: [{ id: "react-workflows", title: "React workflows users can trust", lessons: ["react", "state", "effects", "react-video"].map(id => ({ id, title: id })) }], enrollments: [enrollment] };
  const practice = { storageReady: true, sessions: [{ id, role: "React Developer", status: "active", updated_at: enrollment.updated_at }] };
  const before = JSON.stringify([learning, practice]);
  const actions = homeContinuations(learning, practice);
  assert.deepEqual(actions.map(a => a.href), ["/learn/react-workflows", `/practice?session=${id}`]);
  assert.match(actions[0].text, /1\/4 exercises saved/);
  assert.equal(JSON.stringify([learning, practice]), before);
  assert.deepEqual(homeContinuations(null, {}), []);
  assert.deepEqual(homeContinuations({ ...learning, storageReady: false }, { ...practice, storageReady: false }), []);
  const finishedLessons = { ...learning, enrollments: [{ ...enrollment, completed: ["react", "state", "effects", "react-video"] }] };
  assert.equal(homeContinuations(finishedLessons, null)[0].cta, "Review learning path");
  assert.deepEqual(homeContinuations({ ...finishedLessons, credentials: [{ kind: "jobpilot", path_id: "react-workflows", revoked_at: null }] }, { ...practice, sessions: [{ ...practice.sessions[0], status: "complete" }] }), []);
  for (const bad of ["unknown-path", "https://evil.example", null]) {
    assert.deepEqual(homeContinuations({ ...learning, enrollments: [{ ...enrollment, path_id: bad }] }, null), []);
  }
  assert.deepEqual(homeContinuations({ ...learning, enrollments: [{ ...enrollment, selected_lesson: "unknown" }] }, { ...practice, sessions: [{ ...practice.sessions[0], id: "../other" }] }), []);
  assert.deepEqual(homeContinuations({ ...learning, enrollments: [{ ...enrollment, updated_at: "invalid" }] }, null), []);
});
