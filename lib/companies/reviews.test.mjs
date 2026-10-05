import test from "node:test";
import assert from "node:assert/strict";
import {
  validateRating,
  validateReviewInput,
  calculateReviewSummary,
} from "./reviews.ts";

test("validateRating enforces integer ratings from 1 to 5", () => {
  assert.equal(validateRating(1), 1);
  assert.equal(validateRating(5), 5);
  assert.equal(validateRating(4), 4);

  assert.throws(() => validateRating(0), /between 1 and 5/);
  assert.throws(() => validateRating(6), /between 1 and 5/);
  assert.throws(() => validateRating(3.5), /between 1 and 5/);
  assert.throws(() => validateRating("5"), /between 1 and 5/);
});

test("validateReviewInput accepts valid complete review payload", () => {
  const valid = {
    rating: 4,
    workLifeRating: 5,
    growthRating: 4,
    cultureRating: 4,
    title: "Great culture and mentorship",
    pros: "Very supportive leadership and solid remote work flexibility.",
    cons: "Compensation cycles can be slow during annual reviews.",
    roleTitle: "Software Engineer",
    employmentStatus: "current",
  };

  const result = validateReviewInput(valid);
  assert.equal(result.rating, 4);
  assert.equal(result.workLifeRating, 5);
  assert.equal(result.title, "Great culture and mentorship");
  assert.equal(result.employmentStatus, "current");
});

test("validateReviewInput rejects missing or invalid fields", () => {
  assert.throws(() => validateReviewInput(null), /must be an object/);
  assert.throws(
    () =>
      validateReviewInput({
        rating: 5,
        title: "Hi",
        pros: "Short",
        cons: "Short",
        roleTitle: "Dev",
        employmentStatus: "current",
      }),
    /title must be between 3 and 120/,
  );

  assert.throws(
    () =>
      validateReviewInput({
        rating: 5,
        title: "Good place to work",
        pros: "Too short",
        cons: "Too short",
        roleTitle: "Dev",
        employmentStatus: "current",
      }),
    /Pros description must be between 10 and 1000/,
  );

  assert.throws(
    () =>
      validateReviewInput({
        rating: 5,
        title: "Good place to work",
        pros: "Generous leave and great benefits always provided.",
        cons: "Too short",
        roleTitle: "Dev",
        employmentStatus: "current",
      }),
    /Cons description must be between 10 and 1000/,
  );

  assert.throws(
    () =>
      validateReviewInput({
        rating: 5,
        title: "Good place to work",
        pros: "Generous leave and great benefits always provided.",
        cons: "Can have occasional late night releases on weekends.",
        roleTitle: "Dev",
        employmentStatus: "random_status",
      }),
    /Employment status must be/,
  );
});

test("calculateReviewSummary computes metrics and distributions", () => {
  const reviews = [
    { rating: 5, work_life_rating: 4, growth_rating: 5, culture_rating: 5 },
    { rating: 3, work_life_rating: 2, growth_rating: 3, culture_rating: 3 },
  ];

  const summary = calculateReviewSummary(reviews);
  assert.equal(summary.totalReviews, 2);
  assert.equal(summary.averageRating, 4);
  assert.equal(summary.workLifeAvg, 3);
  assert.equal(summary.growthAvg, 4);
  assert.equal(summary.cultureAvg, 4);
  assert.equal(summary.ratingDistribution[5], 1);
  assert.equal(summary.ratingDistribution[3], 1);
});

test("calculateReviewSummary handles empty reviews list honestly", () => {
  const summary = calculateReviewSummary([]);
  assert.equal(summary.totalReviews, 0);
  assert.equal(summary.averageRating, 0);
  assert.equal(summary.workLifeAvg, null);
});
