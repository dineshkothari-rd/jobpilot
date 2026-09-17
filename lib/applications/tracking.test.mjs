import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import { automaticFollowUp } from "./follow-up.ts";
import { isApplicationAnswer } from "./package.ts";
import { candidateAnswersWithFacts, parseApplicationFacts } from "./facts.ts";

let client;
const route = new Module(import.meta.filename);
route.require = (name) => {
  if (name === "@/lib/supabase/server") return { createClient: async () => client };
  if (name === "@/lib/applications/follow-up") return { automaticFollowUp };
  if (name === "@/lib/applications/package") return { isApplicationAnswer };
  if (name === "@/lib/applications/facts") return { candidateAnswersWithFacts, parseApplicationFacts };
  if (name === "@/lib/matching/scorer") return { getResumeSkills: () => [] };
  throw Error("Unexpected dependency " + name);
};
route._compile(ts.transpileModule(readFileSync(new URL("../../app/api/applications/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, import.meta.filename);

function database(owner = "owner") {
  const row = { id: "application", job_id: "job", user_id: "owner", status: "saved",
    applied_at: null, follow_up_at: null, notes: "Keep notes", resume_id: "tailored",
    created_at: "2026-09-01", updated_at: "2026-09-01" };
  return { row, auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null }, error: null }) },
    from(table) {
      assert.equal(table, "applications");
      const filters = [];
      let updates;
      const query = {
        select() { return query; },
        update(value) { updates = value; return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        async maybeSingle() {
          if (!filters.every(([key, value]) => row[key] === value)) return { data: null, error: null };
          if (updates) Object.assign(row, updates);
          return { data: { ...row }, error: null };
        },
        async single() { return query.maybeSingle(); },
      };
      return query;
    } };
}
const request = (body) => new Request("https://jobpilot.test/api/applications", {
  method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
});

test("saved package confirmation advances once across legacy entry points and preserves notes/resume", async () => {
  client = database();
  const response = await route.exports.POST(request({ jobId: "job", status: "applied" }));
  assert.equal(response.status, 200);
  assert.equal(client.row.status, "applied");
  assert.equal(client.row.notes, "Keep notes");
  assert.equal(client.row.resume_id, "tailored");
  assert.equal(Date.parse(client.row.follow_up_at) - Date.parse(client.row.applied_at), 7 * 86400000);
  const appliedAt = client.row.applied_at;
  const followUpAt = client.row.follow_up_at;
  await route.exports.POST(request({ jobId: "job", status: "applied" }));
  assert.equal(client.row.applied_at, appliedAt);
  assert.equal(client.row.follow_up_at, followUpAt);
});

test("tracking requires authentication and PATCH cannot update another owner's row", async () => {
  client = database(null);
  assert.equal((await route.exports.POST(request({ jobId: "job" }))).status, 401);
  client = database("other-owner");
  assert.equal((await route.exports.PATCH(request({ applicationId: "application", status: "applied" }))).status, 404);
  assert.equal(client.row.status, "saved");
});

test("GET exposes current reusable facts, canonical legal preferences, and tolerates absent facts schema", async () => {
  for (const ready of [false, true]) {
    const records = {
      applications: [], resumes: [], application_submissions: [], job_preferences: null,
      profiles: { full_name: "Candidate", ...(ready ? { application_facts: { Phone: "", "Current CTC": "INR 12 lakh/year" } } : {}) },
      autopilot_preferences: { work_authorization: "Authorized in India", notice_period: "30 days" },
    };
    client = {
      auth: { getUser: async () => ({ data: { user: { id: "owner", email: "preview@example.com" } }, error: null }) },
      from(table) {
        const query = {
          select() { return query; }, order() { return query; },
          eq(key, value) { assert.equal(key, table === "profiles" ? "id" : "user_id"); assert.equal(value, "owner"); return query; },
          maybeSingle() { return Promise.resolve({ data: records[table], error: null }); },
          then(resolve, reject) { return query.maybeSingle().then(resolve, reject); },
        };
        return query;
      },
    };
    const response = await route.exports.GET();
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.candidate_id, "owner");
    assert.equal(result.facts_storage_ready, ready);
    assert.equal(result.candidate_answers.find((answer) => answer.question === "Notice period").answer, "30 days");
    assert.equal(result.candidate_answers.some((answer) => answer.question === "Current CTC"), ready);
  }
});
