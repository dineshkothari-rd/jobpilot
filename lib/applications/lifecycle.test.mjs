import assert from "node:assert/strict";
import test from "node:test";
import { applicationStatuses, canTransitionApplication, isSubmittedApplication } from "./lifecycle.ts";

test("application lifecycle keeps preparation saved and permits submitted-stage corrections", () => {
  assert.equal(canTransitionApplication("saved", "applied"), true);
  assert.equal(canTransitionApplication("saved", "withdrawn"), true);
  for (const status of ["screening", "interview", "offer", "rejected"]) {
    assert.equal(canTransitionApplication("saved", status), false);
  }
  for (const from of applicationStatuses.filter((status) => status !== "saved")) {
    assert.equal(canTransitionApplication(from, "saved"), false);
  }
  assert.equal(canTransitionApplication("interview", "screening"), true);
  assert.equal(canTransitionApplication("rejected", "interview"), true);
  assert.equal(isSubmittedApplication("applied"), true);
  assert.equal(isSubmittedApplication("saved"), false);
  assert.equal(isSubmittedApplication("withdrawn"), false);
});
