import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import { candidateAnswersWithFacts, mergeApplicationAnswers, parseApplicationFacts } from "./facts.ts";
import { isCurrentApplicationProgress } from "./progress.ts";
import { autofillPayload } from "./package.ts";

test("saved facts validate, override stale snapshots, and never export legal or compensation answers", () => {
  const facts = parseApplicationFacts({ Phone: " +91 123 ", "Current CTC": "INR 12 lakh/year" });
  assert.equal(facts.Phone, "+91 123");
  for (const bad of [null, [], { OCI: "Yes" }, { Phone: 12 }, { Phone: "x".repeat(1001) }, { "Portfolio URL": "javascript:alert(1)" }, { "Portfolio URL": "https://u:p@example.com" }]) assert.throws(() => parseApplicationFacts(bad));
  const old = [{ question: "Phone", answer: "old", source: "Resume" }];
  assert.equal(candidateAnswersWithFacts(old, { Phone: "" }).length, 0, "explicitly cleared facts do not resurrect resume guesses");
  const answers = candidateAnswersWithFacts([...old, { question: "Notice period", answer: "Immediate", source: "Current settings" }], facts);
  const merged = mergeApplicationAnswers(answers, [{ question: "Notice period", answer: "90 days", source: "Old preparation" }]);
  assert.equal(merged.find((item) => item.question === "Notice period").answer, "Immediate");
  assert.deepEqual(JSON.parse(autofillPayload("https://employer.example/apply", merged)).fields, [{ question: "Phone", answer: "+91 123" }]);
  assert.equal(mergeApplicationAnswers([{ question: "Work authorization", answer: "", source: "Current settings" }], [{ question: "Work authorization", answer: "Stale", source: "Snapshot" }]).length, 0);
  const now = Date.now();
  const marker = { version: 1, applicationUrl: "https://employer.example/apply", openedAt: now };
  assert.equal(isCurrentApplicationProgress(marker, marker.applicationUrl, now), true);
  assert.equal(isCurrentApplicationProgress(marker, "https://other.example", now), false);
  assert.equal(isCurrentApplicationProgress(marker, marker.applicationUrl, now + 86400000), false);
  assert.equal(isCurrentApplicationProgress({ ...marker, openedAt: now + 1 }, marker.applicationUrl, now), false);
});

let client;
const route = new Module(import.meta.filename);
route.require = (name) => {
  if (name === "@/lib/supabase/server") return { createClient: async () => client };
  if (name === "@/lib/applications/facts") return { parseApplicationFacts };
  throw Error("Unexpected dependency " + name);
};
route._compile(ts.transpileModule(readFileSync(new URL("../../app/api/applications/answers/route.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, import.meta.filename);
function database({ user = "owner", error = null, owner = "owner", facts = {} } = {}) {
  const row = { id: owner, application_facts: facts };
  return { row, auth: { getUser: async () => ({ data: { user: user ? { id: user } : null }, error: null }) },
    from(table) {
      assert.equal(table, "profiles");
      let updates;
      const filters = [];
      const query = {
        update(value) { updates = value; return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        select() { return query; },
        async maybeSingle() {
          if (error) return { data: null, error };
          if (!filters.every(([key, value]) => key === "application_facts" ? JSON.stringify(row[key]) === value : row[key] === value)) return { data: null, error: null };
          Object.assign(row, updates);
          return { data: row, error: null };
        },
      };
      return query;
    },
  };
}
const request = (body) => new Request("https://jobpilot.test/api/applications/answers", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
test("answer saving requires confirmation, ownership, current version, and handles pending setup", async () => {
  const body = { confirmed: true, facts: { "Current CTC": "INR 12 lakh/year" }, previousFacts: {} };
  client = database({ user: null });
  assert.equal((await route.exports.PUT(request(body))).status, 401);
  client = database();
  assert.equal((await route.exports.PUT(request({ ...body, confirmed: false }))).status, 400);
  assert.equal((await route.exports.PUT(request({ ...body, facts: { OCI: "Yes" } }))).status, 400);
  assert.equal((await route.exports.PUT(request(body))).status, 200);
  assert.equal(client.row.application_facts["Current CTC"], body.facts["Current CTC"]);
  assert.equal((await route.exports.PUT(request(body))).status, 409, "stale tabs cannot overwrite updated facts");
  client = database({ user: "other" });
  assert.equal((await route.exports.PUT(request(body))).status, 409);
  assert.deepEqual(client.row.application_facts, {});
  client = database({ error: { code: "PGRST204" } });
  assert.equal((await route.exports.PUT(request(body))).status, 503);
  client = database({ error: { code: "network" } });
  assert.equal((await route.exports.PUT(request(body))).status, 500);
});
