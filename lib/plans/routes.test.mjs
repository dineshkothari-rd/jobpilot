import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import ts from "typescript";
import { hiringInput } from "../recruiter/applications.ts";
import { uuid } from "../recruiter/validation.ts";
const owner = "00000000-0000-4000-8000-000000000010", target = "00000000-0000-4000-8000-000000000020";
let denied = false, rpcError = null, calls = [];
const json = (body, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
const admin = { rpc: async (name, args) => { calls.push({ name, args }); return { error: rpcError, data: name === "get_launch_usage" ? { plan: "free_launch", allowances: [] } : true }; } };
function load(path) {
  const routeModule = new Module(import.meta.filename);
  routeModule.require = name => {
    if (name === "@/lib/recruiter/applications") return { hiringInput };
    if (name === "@/lib/recruiter/validation") return { uuid };
    if (name === "@/lib/recruiter/server") return { json, requestBody: async request => request.json(), recruiterContext: async (request, adminOnly) => {
      if (request && request.headers.get("origin") !== new URL(request.url).origin) return { response: json({ error: "Origin rejected" }, 403) };
      if (denied) return { response: json({ error: "Sign in required" }, 401) };
      if (path.includes("admin/roles")) assert.equal(adminOnly, true);
      return { admin, user: { id: owner } };
    } };
    throw Error(name);
  };
  routeModule._compile(ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, import.meta.filename);
  return routeModule.exports;
}
const usage = load("../../app/api/plans/usage/route.ts"), roles = load("../../app/api/admin/roles/route.ts");
const request = (body, origin = "https://jobpilot.test") => new Request("https://jobpilot.test/api/admin/roles", { method: "PATCH", headers: { Origin: origin }, body: JSON.stringify(body) });
test("usage binds the authenticated account and role mutations enforce origin, actor binding, strict fields and safe errors", async () => {
  denied = true;
  assert.equal((await usage.GET()).status, 401); assert.equal(calls.length, 0);
  denied = false;
  assert.equal((await usage.GET(new Request(`https://jobpilot.test/api/plans/usage?user_id=${target}`))).status, 200);
  assert.deepEqual(calls[0], { name: "get_launch_usage", args: { p_user: owner } });
  const body = { user_id: target, expected_role: "member", role: "admin", reason: "Approved backup administrator" };
  calls = [];
  assert.equal((await roles.PATCH(request(body, "https://other.test"))).status, 403);
  assert.equal((await roles.PATCH(request({ ...body, actor_id: target }))).status, 400); assert.equal(calls.length, 0);
  assert.equal((await roles.PATCH(request(body))).status, 200);
  assert.equal(calls[0].args.p_actor, owner); assert.equal(calls[0].args.p_user, target);
  for (const [message, status] of [["role_conflict", 409], ["self_role_change", 409], ["admin_required", 403], ["private database detail", 503]]) {
    rpcError = { message };
    const response = await roles.PATCH(request(body)); assert.equal(response.status, status); assert.ok(!JSON.stringify(await response.json()).includes("private database"));
  }
});
