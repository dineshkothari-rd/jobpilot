import assert from "node:assert/strict";
import test from "node:test";
import * as savedSearches from "./saved-searches.ts";

test("validateSavedSearchName enforces non-empty names and bounds", () => {
  assert.equal(savedSearches.validateSavedSearchName("").valid, false);
  assert.equal(savedSearches.validateSavedSearchName("   ").valid, false);
  assert.equal(savedSearches.validateSavedSearchName(null).valid, false);

  const valid = savedSearches.validateSavedSearchName("Remote React Roles");
  assert.equal(valid.valid, true);
  assert.equal(valid.sanitized, "Remote React Roles");

  // Clamps long names
  const longName = "A".repeat(150);
  const clamped = savedSearches.validateSavedSearchName(longName);
  assert.equal(clamped.valid, true);
  assert.equal(clamped.sanitized.length, 100);
});

test("validateSavedSearchCriteria validates and sanitizes search options", () => {
  assert.equal(savedSearches.validateSavedSearchCriteria(null).valid, false);
  assert.equal(savedSearches.validateSavedSearchCriteria("invalid").valid, false);

  const raw = {
    search: "  Software Engineer  ",
    workplace: "remote",
    experience: "senior",
    industry: "engineering",
    datePosted: "7d",
    salaryMinFloor: 120000,
    location: "Bengaluru",
    employmentType: "full-time",
    minimumScore: 75,
    sourceFilter: "himalayas",
    sort: "salary",
    maliciousKey: "drop table",
  };

  const res = savedSearches.validateSavedSearchCriteria(raw);
  assert.equal(res.valid, true);
  assert.equal(res.criteria.search, "Software Engineer");
  assert.equal(res.criteria.workplace, "remote");
  assert.equal(res.criteria.experience, "senior");
  assert.equal(res.criteria.salaryMinFloor, 120000);
  assert.equal(res.criteria.sourceFilter, "himalayas");
  // Malicious key should not be in validated criteria
  assert.equal("maliciousKey" in res.criteria, false);
});

test("formatCriteriaSummary produces readable badges", () => {
  const summary = savedSearches.formatCriteriaSummary({
    search: "React",
    workplace: "remote",
    experience: "senior",
    salaryMinFloor: 100000,
  });

  assert.deepEqual(summary, ['"React"', "Remote", "Senior", "$100k+ / ₹1L"]);

  const emptySummary = savedSearches.formatCriteriaSummary({});
  assert.deepEqual(emptySummary, ["All open roles"]);
});
