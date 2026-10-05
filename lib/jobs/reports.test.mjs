import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import * as reports from "./reports.ts";
import { jobId } from "./manual.ts";
const id = "00000000-0000-4000-8000-000000000037";

test("report validation bounds input and trusts only server-managed admin metadata", () => {
  assert.deepEqual(reports.parseJobReport({ job_id: id, category: "payment", details: "  Requested a payment  " }), { job_id: id, category: "payment", details: "Requested a payment" });
  for (const value of [null, [], { job_id: id, category: "__proto__", details: "Requested a payment" }, { job_id: id, category: "payment", details: "short" }, { job_id: id, category: "payment", details: "x".repeat(2001) }, { job_id: id, category: "payment", details: "Requested a payment", status: "confirmed" }]) assert.throws(() => reports.parseJobReport(value));
  assert.equal(reports.isModerator({ user_metadata: { role: "admin" } }), false);
  assert.equal(reports.isModerator({ app_metadata: { role: "admin" } }), true);
});

test("report API enforces authentication, admin access, origins, duplicate/rate handling and stale reviews", async () => {
  let user = null, code = null, found = true; const writes = [];
  const client = { auth: { getUser: async () => ({ data: { user } }) }, from(table) {
    assert.equal(table, "job_reports");
    const query = new Proxy({}, { get(_, method) {
      if (method === "then") return resolve => resolve({ data: found ? { id } : null, error: code ? { code } : null });
      return (...args) => { if (["insert", "update"].includes(method)) writes.push({ method, value: args[0] }); return query; };
    } });
    return query;
  } };
  const loaded = new Module(import.meta.filename);
  loaded.require = name => {
    if (name === "@/lib/supabase/server") return { createClient: async () => client };
    if (name === "@/lib/jobs/reports") return reports;
    assert.equal(name, "@/lib/jobs/manual"); return { jobId };
  };
  loaded._compile(ts.transpileModule(readFileSync(new URL("../../app/api/jobs/reports/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, import.meta.filename);
  const route = loaded.exports;
  const request = (method, body, origin = "https://jobpilot.test") => new Request("https://jobpilot.test/api/jobs/reports", { method, headers: { origin }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const report = { job_id: id, category: "payment", details: "Requested a payment" };
  assert.equal((await route.POST(request("POST", report))).status, 401);
  user = { id, user_metadata: { role: "admin" } };
  assert.equal((await route.GET(request("GET"))).status, 403);
  assert.equal((await route.PATCH(request("PATCH", {}))).status, 403);
  assert.equal((await route.POST(request("POST", report, "https://evil.test"))).status, 403);
  assert.equal(writes.length, 0);
  assert.equal((await route.POST(request("POST", { ...report, status: "confirmed" }))).status, 400);
  assert.equal((await route.POST(request("POST", report))).status, 201);
  assert.equal(writes[0].value.user_id, id);
  code = "23505"; assert.equal((await route.POST(request("POST", report))).status, 200);
  code = "P0001"; assert.equal((await route.POST(request("POST", report))).status, 429);
  code = "42501"; assert.equal((await route.POST(request("POST", report))).status, 404);
  code = null; user.app_metadata = { role: "admin" };
  assert.equal((await route.PATCH(request("PATCH", { id, status: "confirmed", note: "" }))).status, 400);
  assert.equal((await route.PATCH(request("PATCH", { id, status: "confirmed", note: "Confirmed impersonation" }))).status, 200);
  assert.equal(writes.at(-1).value.reviewed_by, id);
  found = false; assert.equal((await route.PATCH(request("PATCH", { id, status: "dismissed", note: "Already reviewed" }))).status, 409);
  assert.equal((await route.POST(request("POST", { ...report, details: "x".repeat(13000) }))).status, 413);
});
