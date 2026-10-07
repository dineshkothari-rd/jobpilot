import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
let signedIn = true, failed = false, calls = [];
const owner = "owner";
const client = { auth: { getUser: async () => ({ data: { user: signedIn ? { id: owner } : null } }) }, from: table => {
  const call = { table, filters: {} }; calls.push(call);
  const q = { select: value => { call.fields = value; return q; }, eq: (key, value) => { call.filters[key] = value; return q; }, gte: (key, value) => { call.filters[key] = value; return q; }, order: () => q, limit: value => { call.limit = value; return q; }, then: resolve => resolve({ error: failed, data: Array.from({ length: 26 }, (_, i) => ({ id: `${table}/${i}`, run_day: "2026-10-07", channel: "email", status: "sent", attempts: 1, sent_at: null, lease_until: "2026-10-07T00:00:00Z", recipient_key: "private-device", user_id: "private-owner", endpoint: "private-endpoint" })) }) };
  return q;
} };
const routeModule = new Module(import.meta.filename);
routeModule.require = name => {
  if (name === "@/lib/supabase/server") return { createClient: async () => client };
  if (name === "@/lib/recruiter/server") return { json: (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } }) };
  throw Error(name);
};
routeModule._compile(ts.transpileModule(readFileSync(new URL("../../app/api/notifications/history/route.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, import.meta.filename);
test("delivery history is authenticated, owner-bound, bounded, private and omits endpoint/recipient data", async () => {
  signedIn = false;
  assert.equal((await routeModule.exports.GET()).status, 401); assert.equal(calls.length, 0);
  signedIn = true;
  const response = await routeModule.exports.GET(), body = await response.json();
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.equal(body.history.length, 25); assert.equal(body.more, true);
  assert.ok(!JSON.stringify(body).includes("private-"));
  for (const call of calls) { assert.equal(call.filters.user_id, owner); assert.equal(call.limit, 26); assert.ok(!call.fields.includes("recipient_key")); }
  failed = true;
  assert.equal((await routeModule.exports.GET()).status, 503);
});
