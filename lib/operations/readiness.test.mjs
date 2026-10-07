import assert from "node:assert/strict";
import test from "node:test";
import { Module } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as helpers from "./status.ts";
let denied = true, queryFailed = false, calls = 0;
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const admin = { from: name => { assert.equal(name, "worker_runs"); calls++; const q = { select: () => q, eq: () => q, order: () => q, limit: value => { assert.equal(value, 20); return q; }, then: resolve => resolve({ error: queryFailed, data: [] }) }; return q; } };
const routeModule = new Module(import.meta.filename);
routeModule.require = name => {
  if (name === "@/lib/recruiter/server") return { json, recruiterContext: async (_request, adminOnly) => { assert.equal(adminOnly, true); return denied ? { response: json({ error: "Admin required" }, 403) } : { admin }; } };
  if (name === "@/lib/notifications/reminders") return { reminderConfiguration: () => ({ email: false, push: true, publicKey: "private-key" }) };
  if (name === "@/lib/calendars/provider") return { calendarConfig: () => ({ ready: true, clientSecret: "private-secret" }) };
  if (name === "@/lib/operations/status") return helpers;
  throw Error(name);
};
routeModule._compile(ts.transpileModule(readFileSync(new URL("../../app/api/admin/readiness/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, import.meta.filename);
test("readiness remains admin-only and exposes only booleans/safe history while distinguishing unavailable from never run", async () => {
  assert.equal((await routeModule.exports.GET()).status, 403); assert.equal(calls, 0);
  denied = false;
  const response = await routeModule.exports.GET(), value = await response.json();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(value.workers.length, 3); assert.equal(value.workers[0].health, "never_run");
  assert.ok(!JSON.stringify(value).includes("private-"));
  assert.ok(value.pending_release_checks.length > 0);
  queryFailed = true;
  assert.ok((await (await routeModule.exports.GET()).json()).workers.every(worker => worker.health === "unavailable"));
});
