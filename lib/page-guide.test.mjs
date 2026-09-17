import assert from "node:assert/strict";
import test from "node:test";
import { pageGuide, searchGoals } from "./page-guide.ts";

test("guidance follows route boundaries and never creates external shortcuts", () => {
  for (const route of ["dashboard", "jobs", "applications", "autopilot", "learn", "practice", "saved-jobs", "resume", "profile", "career"]) {
    assert.deepEqual(pageGuide(`/${route}`), pageGuide(`/${route}/nested`));
    assert.match(pageGuide(`/${route}`).href, /^\/(?!\/)/);
  }
  for (const route of ["/", "/__proto__", "/constructor", "/jobs-fake"]) assert.deepEqual(pageGuide(route), pageGuide("/dashboard"));
  assert.deepEqual(pageGuide("/jobs/123/interview"), pageGuide("/practice"));
  assert.equal(pageGuide("/jobs/123/prepare").title, "Prepare for this role");
  assert.equal(new Set(searchGoals.map(goal => goal.href)).size, 4);
  assert.ok(searchGoals.every(goal => goal.href.startsWith("/") && goal.text && goal.action));
});
