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
  assert.doesNotMatch(render(), /<details\b/);
  assert.match(render(), /aria-label="Breadcrumb"/);
  assert.match(render({ home: true }), /Want to work on something else/);
  assert.doesNotMatch(render({ home: true }), /<details[^>]*\bopen(?:=|\s|>)/);
});
