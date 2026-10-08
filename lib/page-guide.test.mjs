import assert from "node:assert/strict";
import test from "node:test";
import { pageGuide, searchGoals, workspaceDestinations } from "./page-guide.ts";
import { readFileSync } from "node:fs";
import { Module } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

test("guidance follows route boundaries and never creates external shortcuts", () => {
  for (const route of ["dashboard", "jobs", "applications", "autopilot", "learn", "practice", "portfolio", "saved-jobs", "resume", "profile", "career", "inbox", "recruiter", "admin", "moderation", "company-verifications", "billing", "companies", "salaries", "internships"]) {
    assert.deepEqual(pageGuide(`/${route}`), pageGuide(`/${route}/nested`));
    assert.match(pageGuide(`/${route}`).href, /^\/(?!\/)/);
  }
  for (const route of ["/", "/__proto__", "/constructor", "/jobs-fake"]) assert.deepEqual(pageGuide(route), pageGuide("/dashboard"));
  assert.deepEqual(pageGuide("/jobs/123/interview"), pageGuide("/practice"));
  assert.equal(pageGuide("/jobs/123/prepare").title, "Prepare for this role");
  assert.equal(new Set(searchGoals.map(goal => goal.href)).size, 4);
  assert.ok(searchGoals.every(goal => goal.href.startsWith("/") && goal.text && goal.action));
});

test("help is collapsed initially, preserves native controls and is not duplicated on Home", () => {
  const file = new URL("../components/layout/page-guide.tsx", import.meta.url).pathname;
  const component = new Module(file);
  component.paths = Module._nodeModulePaths(file.slice(0, file.lastIndexOf("/")));
  let pathname = "/jobs";
  const require = component.require.bind(component);
  component.require = id => {
    if (id === "next/navigation") return { usePathname: () => pathname, useRouter: () => ({ push() {} }) };
    if (id === "next/link") return { default: props => React.createElement("a", props) };
    if (id === "@/lib/page-guide") return { pageGuide, searchGoals, workspaceDestinations };
    return require(id);
  };
  component._compile(ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
  const render = props => renderToStaticMarkup(React.createElement(component.exports.PageGuide, props));
  assert.match(render(), /<details\b/);
  assert.doesNotMatch(render(), /<details[^>]*\bopen(?:=|\s|>)/);
  assert.match(render(), /<summary\b/);
  assert.equal((render().match(/aria-pressed="false"/g) || []).length, 4);
  pathname = "/dashboard";
  assert.doesNotMatch(render(), /workspace-help/);
  assert.match(render(), /aria-label="Switch workspace tool"/);
  assert.match(render(), /aria-label="Breadcrumb"/);
  assert.match(render({ home: true }), /Want to work on something else/);
  assert.doesNotMatch(render({ home: true }), /<details[^>]*\bopen(?:=|\s|>)/);
});

test("design preview is development-only at both proxy and page boundaries", async () => {
  const original = process.env.NODE_ENV;
  const compilerOptions = { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX };
  const proxy = new Module(import.meta.filename);
  class NextResponse extends Response { static next() { return new NextResponse(null); } }
  proxy.require = id => {
    if (id === "next/server") return { NextResponse };
    if (id === "@/lib/site-url") return {};
    if (id === "@supabase/ssr") return { createServerClient() { throw Error("Preview must not require authentication"); } };
    throw Error(id);
  };
  proxy._compile(ts.transpileModule(readFileSync(new URL("../proxy.ts", import.meta.url), "utf8"), { compilerOptions }).outputText, import.meta.filename);
  const page = new Module(import.meta.filename);
  page.paths = Module._nodeModulePaths(process.cwd());
  const normalRequire = page.require.bind(page);
  page.require = id => {
    if (id === "next/navigation") return { notFound() { throw Error("NOT_FOUND"); } };
    if (id.startsWith("@/") || id === "next/link" || id === "lucide-react") return {};
    return normalRequire(id);
  };
  page._compile(ts.transpileModule(readFileSync(new URL("../app/design-preview/page.tsx", import.meta.url), "utf8"), { compilerOptions }).outputText, import.meta.filename);
  try {
    for (const env of ["production", "test"]) {
      process.env.NODE_ENV = env;
      assert.equal((await proxy.exports.proxy({ nextUrl: { pathname: "/design-preview" } })).status, 404);
      await assert.rejects(page.exports.default({ searchParams: Promise.resolve({}) }), /NOT_FOUND/);
    }
    process.env.NODE_ENV = "development";
    assert.equal((await proxy.exports.proxy({ nextUrl: { pathname: "/design-preview" } })).status, 200);
  } finally {
    if (original === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = original;
  }
});
