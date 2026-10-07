import assert from "node:assert/strict";
import test from "node:test";
import { Module } from "node:module";
import { readFileSync } from "node:fs";
import ts from "typescript";
import * as policy from "./policy.ts";
let result = { data: 1 }, calls = [];
const admin = { rpc: async (name, args) => { calls.push({ name, args }); return result; } };
const routeModule = new Module(import.meta.filename);
routeModule.require = name => {
  if (name === "server-only") return {};
  if (name === "@supabase/supabase-js") return { createClient: () => admin };
  if (name === "./policy") return policy;
  throw Error(name);
};
routeModule._compile(ts.transpileModule(readFileSync(new URL("./server.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText, import.meta.filename);
test("allowance boundary admits only successful consumption and safely maps exhausted, unauthorized and unavailable states", async () => {
  const { consumeAllowance } = routeModule.exports;
  await consumeAllowance("owner", "interview_ai", admin);
  assert.deepEqual(calls[0], { name: "consume_launch_allowance", args: { p_user: "owner", p_meter: "interview_ai" } });
  for (const [message, status] of [["allowance_exhausted", 429], ["company_not_verified", 409], ["private database payload", 503]]) {
    result = { error: { message } };
    await assert.rejects(consumeAllowance("owner", "interview_ai", admin), error => error.status === status && !error.message.includes("private"));
  }
  result = { data: null };
  await assert.rejects(consumeAllowance("owner", "autopilot", admin), error => error.status === 503);
  assert.equal(policy.remainingAllowance(5, 8), 0);
});
