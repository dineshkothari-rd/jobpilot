import assert from "node:assert/strict";
import test from "node:test";

import {
  InvalidAutopilotPreferencesError,
  parsePreferences,
  preferencesFromRow,
} from "./preferences.ts";

test("normalizes and bounds autopilot preferences", () => {
  const result = parsePreferences({
    enabled: true,
    targetRoles: [" Engineer ", "Engineer", 42],
    workplaceModes: ["remote", "invalid"],
    dailyLimit: 100,
    matchThreshold: -5,
    salaryMin: "100",
    salaryMax: "200",
  });

  assert.deepEqual(result.targetRoles, ["Engineer"]);
  assert.deepEqual(result.workplaceModes, ["remote"]);
  assert.equal(result.dailyLimit, 50);
  assert.equal(result.matchThreshold, 0);
  assert.equal(result.salaryMin, 100);
});

test("rejects an invalid salary range", () => {
  assert.throws(
    () => parsePreferences({ salaryMin: 200, salaryMax: 100 }),
    InvalidAutopilotPreferencesError,
  );
});

test("free assisted flow disables unsupported automatic submission", () => {
  assert.equal(parsePreferences({ autoSubmit: true }).autoSubmit, false);
  assert.equal(preferencesFromRow({ auto_submit: true }).autoSubmit, false);
});

test("uses existing job preferences as setup defaults", () => {
  const result = preferencesFromRow(null, {
    preferred_roles: ["Developer"],
    preferred_locations: ["Remote"],
    minimum_match_score: 80,
  });

  assert.deepEqual(result.targetRoles, ["Developer"]);
  assert.deepEqual(result.locations, ["Remote"]);
  assert.equal(result.matchThreshold, 80);
  assert.equal(result.enabled, false);
});
