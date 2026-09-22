import assert from "node:assert/strict";
import test from "node:test";
import { createRequire, Module } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as model from "./evidence.ts";

const id = "12345678-1234-4234-8234-123456789012";
const valid = { title: "Hiring workflow", problem: "Reduce candidate drop-off", contribution: "I mapped the process and built the reviewed workflow.", outcome: "Tested with five representative cases.", skills: ["Recruiting", "Research"], evidence_url: "https://example.com/work#details", source_kind: "manual", source_ref: null };

test("portfolio evidence accepts grounded facts and formats an honest resume draft", () => {
  const evidence = model.parseEvidence(valid);
  assert.equal(evidence.evidence_url, "https://example.com/work");
  assert.match(model.resumeProjectEvidence(evidence), /Self-reported project evidence/);
  for (const changes of [{ contribution: "too short" }, { evidence_url: "http://example.com" }, { evidence_url: "https://127.0.0.1/a" }, { skills: ["Excel", "excel"] }, { skills: Array.from({ length: 31 }, (_, index) => `s${index}`) }, { source_kind: "manual", source_ref: "forged" }, { extra: true }]) assert.throws(() => model.parseEvidence({ ...valid, ...changes }));
});

test("portfolio API enforces authentication, ownership, stale writes and deletion", async () => {
  let owner = "";
  const rows = [];
  const client = {
    auth: { getUser: async () => ({ data: { user: owner ? { id: owner } : null } }) },
    from: table => {
      if (table === "skillpath_enrollments") return { select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { project_url: "https://example.com/project", project_summary: "I built the original project and checked every important interaction." }, error: null }) }) }) }) };
      assert.equal(table, "portfolio_evidence"); let operation = "select", value; const filters = [];
      const execute = () => {
        let selected = rows.filter(row => filters.every(([key, expected]) => row[key] === expected));
        if (operation === "insert") { const row = { id, reviewed_at: null, version: 1, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...value }; rows.push(row); return { data: structuredClone(row), error: null }; }
        if (operation === "update") selected.forEach(row => Object.assign(row, value));
        if (operation === "delete") selected.forEach(row => rows.splice(rows.indexOf(row), 1));
        return { data: structuredClone(selected[0] || null), error: null };
      };
      const query = { insert: next => { operation = "insert"; value = next; return query; }, update: next => { operation = "update"; value = next; return query; }, delete: () => { operation = "delete"; return query; }, select: () => query, eq: (key, expected) => { filters.push([key, expected]); return query; }, single: async () => execute(), maybeSingle: async () => execute() };
      return query;
    },
  };
  const require = createRequire(import.meta.url);
  const loaded = new Module(import.meta.filename);
  loaded.require = name => name === "@/lib/supabase/server" ? { createClient: async () => client } : name === "@/lib/portfolio/evidence" ? model : name === "@/lib/learning/catalog-store" ? { loadCatalog: async () => [{ path: { id: "sample-path", title: "Career research", project: "Write an original project summary.", skills: ["Research"] } }] } : require(name);
  loaded._compile(ts.transpileModule(readFileSync(new URL("../../app/api/portfolio/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, import.meta.filename);
  const route = loaded.exports;
  const request = (payload, method = "POST", origin = "https://jobpilot.test") => new Request("https://jobpilot.test/api/portfolio", { method, headers: { Origin: origin }, body: JSON.stringify(payload) });
  assert.equal((await route.POST(request(valid))).status, 401);
  owner = "owner";
  assert.equal((await route.POST(request(valid, "POST", "https://evil.test"))).status, 403);
  assert.equal((await route.POST(request({ ...valid, source_kind: "learning", source_ref: "fabricated" }))).status, 400);
  assert.equal((await route.POST(request(valid))).status, 201);
  assert.equal(rows[0].user_id, owner);
  assert.equal((await route.PATCH(request({ id, version: 1, action: "review" }, "PATCH"))).status, 200);
  assert.ok(rows[0].reviewed_at);
  assert.equal((await route.PATCH(request({ id, version: 1, action: "review" }, "PATCH"))).status, 409);
  const edited = Object.fromEntries(Object.entries(valid).filter(([key]) => !["source_kind", "source_ref"].includes(key)));
  assert.equal((await route.PATCH(request({ id, version: 2, ...edited, outcome: "Rechecked outcome" }, "PATCH"))).status, 200);
  assert.equal(rows[0].reviewed_at, null, "editing resets review");
  assert.equal((await route.DELETE(request({ id, version: 3, user_id: "other" }, "DELETE"))).status, 400);
  assert.equal((await route.DELETE(request({ id, version: 3 }, "DELETE"))).status, 200);
  assert.equal(rows.length, 0);
  assert.equal((await route.POST(request({ action: "learning", pathId: "sample-path", contribution: "Forged" }))).status, 400);
  assert.equal((await route.POST(request({ action: "learning", pathId: "sample-path" }))).status, 201);
  assert.equal(rows[0].source_kind, "learning");
  assert.equal(rows[0].contribution, "I built the original project and checked every important interaction.");
});
