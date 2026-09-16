import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { embeddedApplicationUrl, trustedWorkspace, validatePayload } from "../../extensions/autofill/payload.mjs";
import { fillReviewedFields } from "../../extensions/autofill/fill.mjs";

const url = "https://jobs.lever.co/company/b8dc97ec-a0b7-4195-9f3b-86440ff18f82/apply";
const payload = { version: 1, applicationUrl: url, fields: [{ question: "Email", answer: "reviewed@example.com" }] };

test("connected helper restricts contacts, workspace and embedded employer URLs", () => {
  assert.equal(validatePayload(payload), payload);
  for (const applicationUrl of ["javascript:alert(1)", "https://user:pass@example.com", "https://127.0.0.1", "https://localhost"]) {
    assert.throws(() => validatePayload({ ...payload, applicationUrl }));
  }
  assert.throws(() => validatePayload({ ...payload, fields: [{ question: "OCI", answer: "Yes" }] }));
  assert.throws(() => validatePayload({ ...payload, fields: [...payload.fields, ...payload.fields] }));
  assert.equal(trustedWorkspace("https://jobpilot-murex.vercel.app/applications?job=1"), true);
  assert.equal(trustedWorkspace("https://evil.example/applications"), false);
  assert.equal(trustedWorkspace("https://jobpilot-murex.vercel.app/applications/other"), false);
  assert.equal(embeddedApplicationUrl(url.replace("/apply", "") + "#section"), url);
  for (const value of [url.replace("jobs.lever.co", "jobs.lever.co.evil.example"), url.replace("/apply", "/login"), "https://jobs.lever.co/company", "https://user:pass@" + url.slice(8)]) {
    assert.equal(embeddedApplicationUrl(value), null);
  }
  assert.equal(vm.runInNewContext("(" + fillReviewedFields.toString() + ")(payload, true)", {
    URL, payload, location: { origin: "https://jobpilot-murex.vercel.app", pathname: "/applications" },
  }), null);
});

test("worker accepts only top-level JobPilot requests and never opens a window for embedded forms", async () => {
  let listener;
  let windows = 0;
  const stored = {};
  const chrome = {
    runtime: { onMessage: { addListener: (fn) => { listener = fn; } } },
    tabs: { onRemoved: { addListener() {} } },
    storage: { session: { set: async (items) => Object.assign(stored, items), get: async () => stored, remove: async () => {} } },
    windows: { create: async () => { windows++; return { tabs: [{ id: 8 }] }; } },
  };
  const source = readFileSync(new URL("../../extensions/autofill/worker.js", import.meta.url), "utf8").replace(/^import .*;$/m, "");
  vm.runInNewContext(source, { chrome, embeddedApplicationUrl, trustedWorkspace, validatePayload, Date });
  const send = (message, sender) => new Promise((resolve) => listener(message, sender, resolve));
  const sender = { url: "https://jobpilot-murex.vercel.app/applications", frameId: 0, tab: { id: 7 } };
  assert.equal((await send({ type: "OPEN", payload }, { ...sender, frameId: 1 })).ok, false);
  assert.equal((await send({ type: "FRAME", payload: { ...payload, applicationUrl: "https://evil.example/form" } }, sender)).ok, false);
  assert.equal((await send({ type: "FRAME", payload }, sender)).ok, true);
  assert.equal(windows, 0);
  assert.equal(stored["jobpilot-apply-7"].embedded, true);
  assert.ok(stored["jobpilot-apply-7"].expiresAt > Date.now());
  assert.equal((await send({ type: "OPEN", payload }, sender)).ok, true);
  assert.equal(windows, 1);
  assert.equal(stored["jobpilot-apply-8"].payload, payload);
});

test("embedded autofill requires permission and revokes it even when injection fails", async () => {
  for (const allowed of [false, true]) {
    const elements = Object.fromEntries(["payload", "fill", "feedback", "target", "redirect", "redirect-label"].map((id) => [id, { value: "", addEventListener() {} }]));
    let injected = 0;
    let revoked = 0;
    const stored = { payload, embedded: true, expiresAt: Date.now() + 60000 };
    const chrome = {
      tabs: { query: async () => [{ id: 7, url: "https://jobpilot-murex.vercel.app/applications" }] },
      storage: { session: { get: async () => ({ "jobpilot-apply-7": stored }), remove: async () => {} } },
      permissions: { request: async ({ origins }) => { assert.deepEqual(Array.from(origins), ["https://jobs.lever.co/*"]); return allowed; }, remove: async () => { revoked++; } },
      scripting: { executeScript: async () => { injected++; throw new Error("Blocked frame"); } },
    };
    const source = readFileSync(new URL("../../extensions/autofill/popup.js", import.meta.url), "utf8").replace(/^import .*;$/gm, "");
    const context = vm.createContext({ chrome, document: { getElementById: (id) => elements[id] }, URL, Date, JSON, SyntaxError, embeddedApplicationUrl, validatePayload, fillReviewedFields });
    vm.runInContext(source, context);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(injected, 0, "page load must not fill an embedded form");
    await vm.runInContext("fill()", context);
    assert.equal(injected, allowed ? 1 : 0);
    assert.equal(revoked, allowed ? 1 : 0);
    assert.equal(elements.fill.disabled, false);
  }
});
