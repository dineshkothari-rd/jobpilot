import assert from "node:assert/strict";
import test from "node:test";

import { evaluateAutoApply } from "./eligibility.ts";

const preferences = {
  enabled: true,
  targetRoles: ["Engineer"],
  locations: ["Remote"],
  workplaceModes: ["remote"],
  salaryMin: 100,
  salaryMax: null,
  workAuthorization: "Authorized",
  noticePeriod: "30 days",
  preferredCompanies: [],
  blockedCompanies: ["Blocked Inc"],
  industries: [],
  dailyLimit: 5,
  matchThreshold: 70,
  autoSubmit: true,
};

const safeJob = {
  company: "Acme",
  matchScore: 90,
  applicationUrl: "https://example.com/apply",
  salaryMin: 120,
  salaryMax: 150,
  alreadySubmitted: false,
  profileComplete: true,
  requiredAnswersKnown: true,
  locationMatches: true,
  workplaceMatches: true,
  termsAllowAutomation: true,
  requiresManualStep: false,
  submitIntegration: false,
  appliedToday: 0,
};

test("auto-apply safety rules are deterministic", () => {
  assert.equal(evaluateAutoApply(safeJob, preferences).state, "eligible_assisted");
  assert.equal(evaluateAutoApply({ ...safeJob, submitIntegration: true }, preferences).state, "eligible_automatic");
  assert.equal(evaluateAutoApply({ ...safeJob, alreadySubmitted: true }, preferences).state, "skipped");
  assert.equal(evaluateAutoApply({ ...safeJob, company: "Blocked Inc" }, preferences).state, "skipped");
  assert.equal(evaluateAutoApply({ ...safeJob, matchScore: 69 }, preferences).state, "skipped");
  assert.equal(evaluateAutoApply({ ...safeJob, requiredAnswersKnown: false }, preferences).state, "needs_review");
  assert.equal(evaluateAutoApply({ ...safeJob, locationMatches: false }, preferences).state, "skipped");
  assert.equal(evaluateAutoApply({ ...safeJob, workplaceMatches: false }, preferences).state, "skipped");
  assert.equal(evaluateAutoApply({ ...safeJob, requiresManualStep: true }, preferences).state, "needs_review");
  assert.equal(evaluateAutoApply({ ...safeJob, applicationUrl: "javascript:alert(1)" }, preferences).state, "skipped");
  assert.equal(evaluateAutoApply({ ...safeJob, applicationUrl: "https://localhost/apply" }, preferences).state, "skipped");
});

test("never treats an unconfirmed provider as applied", () => {
  const decision = evaluateAutoApply(safeJob, preferences);
  assert.notEqual(decision.state, "eligible_automatic");
});
