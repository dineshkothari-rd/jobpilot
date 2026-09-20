import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";
import * as model from "./manual.ts";

const id = "12345678-1234-4234-8234-123456789012";
const requestId = "12345678-1234-4234-8234-123456789013";
const valid = { request_id: requestId, title: "Accountant", company: "Example", url: "https://jobs.example.com/role/?utm_source=test&b=2&a=1#apply", description: "Verified role", location: "Jaipur", country: "India", employment_type: "Full-time", skills: "Excel, Tax", expires_on: "2026-10-31" };

test("manual opportunities canonicalize public links and validate user-entered facts", () => {
  const parsed = model.parseManualJob(valid);
  assert.equal(parsed.application_url, "https://jobs.example.com/role?a=1&b=2");
  assert.deepEqual(parsed.skills, ["Excel", "Tax"]);
  assert.equal(parsed.expires_at, "2026-10-31T23:59:59.999Z");
  for (const changes of [{ request_id: "bad" }, { url: "http://jobs.example.com/role" }, { url: "https://user:pass@jobs.example.com/role" }, { url: "https://127.0.0.1/role" }, { skills: "Excel, excel" }, { skills: Array.from({ length: 31 }, (_, i) => `s${i}`).join(",") }, { expires_on: "2026-02-30" }, { expires_on: "2026-99-99" }, { extra: true }]) assert.throws(() => model.parseManualJob({ ...valid, ...changes }));
  assert.doesNotThrow(() => model.parseManualJob({ ...valid, url: "https://abc.de/jobs/1" }));
  assert.equal(model.opportunityFreshness({ expires_at: "2026-09-19T00:00:00Z" }, Date.parse("2026-09-20T00:00:00Z")), "expired");
  assert.equal(model.opportunityFreshness({ published_at: "2026-01-01T00:00:00Z" }, Date.parse("2026-09-20T00:00:00Z")), "stale");
  assert.equal(model.opportunityFreshness({ published_at: "2026-09-19T00:00:00Z" }, Date.parse("2026-09-20T00:00:00Z")), "current");
});

test("manual opportunity API authenticates, deduplicates retries and rejects stale updates", async () => {
  let owner = "", nextId = id;
  const rows = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null } }) },
    from: table => {
      assert.equal(table, "jobs"); let operation = "select", value; const filters = [];
      const execute = () => {
        let selected = rows.filter(row => filters.every(([key, expected]) => row[key] === expected));
        if (operation === "insert") {
          const duplicate = rows.find(row => row.external_id === value.external_id || row.created_by === value.created_by && row.application_url === value.application_url);
          if (duplicate) return { data: null, error: { code: "23505" } };
          const row = { id: nextId, ...value }; rows.push(row); return { data: structuredClone(row), error: null };
        }
        if (operation === "update") selected.forEach(row => Object.assign(row, value));
        return { data: structuredClone(selected[0] || null), error: null };
      };
      const query = { insert: next => { operation = "insert"; value = next; return query; }, update: next => { operation = "update"; value = next; return query; }, select: () => query, eq: (key, expected) => { filters.push([key, expected]); return query; }, single: async () => execute(), maybeSingle: async () => execute() };
      return query;
    },
  };
  const require = createRequire(import.meta.url);
  const loaded = new Module(import.meta.filename);
  loaded.require = name => name === "@/lib/supabase/server" ? { createClient: async () => client } : name === "@/lib/jobs/manual" ? model : require(name);
  loaded._compile(ts.transpileModule(readFileSync(new URL("../../app/api/jobs/manual/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, import.meta.filename);
  const route = loaded.exports;
  const request = (payload, method = "POST", origin = "https://jobpilot.test") => new Request("https://jobpilot.test/api/jobs/manual", { method, headers: { Origin: origin }, body: JSON.stringify(payload) });
  assert.equal((await route.POST(request(valid))).status, 401);
  owner = "owner";
  assert.equal((await route.POST(request(valid, "POST", "https://evil.test"))).status, 403);
  assert.equal((await route.POST(request(valid))).status, 201);
  assert.equal(rows[0].created_by, owner);
  assert.equal(rows[0].source, "user");
  assert.deepEqual(rows[0].raw_data, {});
  assert.equal((await route.POST(request(valid))).status, 200, "same request is idempotent");
  assert.equal((await route.POST(request({ ...valid, request_id: "12345678-1234-4234-8234-123456789014" }))).status, 409, "same URL from another request is a duplicate");
  assert.equal((await route.PATCH(request({ id, closed: true, version: 1 }, "PATCH"))).status, 200);
  assert.ok(rows[0].expires_at);
  assert.equal((await route.PATCH(request({ id, closed: false, version: 1 }, "PATCH"))).status, 409);
  assert.equal((await route.PATCH(request({ id, closed: false, version: 2, created_by: "other" }, "PATCH"))).status, 400);
  assert.equal((await route.POST(request({ padding: "x".repeat(33000) }))).status, 413);
});
