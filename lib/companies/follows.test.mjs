import test from "node:test";
import assert from "node:assert/strict";
import {
  validateCompanySlug,
  isNewOpening,
  computeCompanyAlerts,
} from "./follows.ts";

test("validateCompanySlug validates correctly formatted slugs", () => {
  assert.equal(validateCompanySlug("google"), "google");
  assert.equal(validateCompanySlug("razorpay-india"), "razorpay-india");
  assert.equal(validateCompanySlug("   stripe   "), "stripe");

  assert.throws(() => validateCompanySlug(""), /between 1 and 120/);
  assert.throws(() => validateCompanySlug(null), /must be a string/);
  assert.throws(() => validateCompanySlug("invalid slug!"), /invalid characters/);
  assert.throws(() => validateCompanySlug("a".repeat(125)), /between 1 and 120/);
});

test("isNewOpening detects jobs posted within 7 days", () => {
  const now = new Date("2026-10-05T12:00:00Z");

  const twoDaysAgo = new Date("2026-10-03T12:00:00Z").toISOString();
  assert.equal(isNewOpening(twoDaysAgo, 7, now), true);

  const sixDaysAgo = new Date("2026-09-29T12:00:00Z").toISOString();
  assert.equal(isNewOpening(sixDaysAgo, 7, now), true);

  const tenDaysAgo = new Date("2026-09-25T12:00:00Z").toISOString();
  assert.equal(isNewOpening(tenDaysAgo, 7, now), false);

  assert.equal(isNewOpening(null, 7, now), false);
  assert.equal(isNewOpening("invalid-date", 7, now), false);
});

test("computeCompanyAlerts summarizes total and recent openings", () => {
  const now = new Date("2026-10-05T12:00:00Z");
  const jobs = [
    { published_at: new Date("2026-10-04T12:00:00Z").toISOString() },
    { published_at: new Date("2026-10-01T12:00:00Z").toISOString() },
    { published_at: new Date("2026-09-15T12:00:00Z").toISOString() },
  ];

  const result = computeCompanyAlerts(jobs, now);
  assert.deepEqual(result, {
    totalOpenings: 3,
    newOpeningsLast7Days: 2,
  });
});
