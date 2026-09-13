import assert from "node:assert/strict";
import test from "node:test";

import { generateInterviewPreparationHub } from "./interview-learning.ts";

const baseInput = {
  job: {
    id: "job-1",
    title: "Senior Frontend Engineer",
    company: "Acme",
    description: "Build React and TypeScript products. Improve performance and accessibility.",
    location: "Remote",
    seniority: "Senior",
    employmentType: "Full-time",
    salary: "USD 120,000",
    skills: ["React", "TypeScript", "Performance", "Accessibility", "System Design"],
  },
  candidate: {
    targetRole: "Frontend Engineer",
    experienceYears: 4,
    skills: ["React", "TypeScript"],
    hasProfile: true,
    hasResume: true,
    hasUsableResume: true,
  },
  matchScore: 76,
  application: { id: "app-1", status: "applied", follow_up_at: null },
};

test("generates a complete preparation hub grounded in job skills", () => {
  const hub = generateInterviewPreparationHub(baseInput);

  assert.ok(hub.readiness.score >= 0 && hub.readiness.score <= 100);
  assert.ok(hub.learningTopics.some((topic) => topic.title.toLowerCase() === "performance"));
  assert.ok(hub.questionBank.some((question) => question.category === "technical"));
  assert.ok(hub.studyPlan.some((item) => item.phase === "Mock Interviews"));
  assert.ok(hub.quickRevision.topQuestions.length > 0);
});

test("does not fabricate candidate skills", () => {
  const hub = generateInterviewPreparationHub(baseInput);
  const candidateText = hub.rolePreparation.candidateDerived.join(" ").toLowerCase();

  assert.match(candidateText, /react/);
  assert.doesNotMatch(candidateText, /system design/);
  assert.ok(hub.weakAreas.some((area) => /system design/i.test(area.title)));
});

test("keeps video provider honest when no provider exists", () => {
  const hub = generateInterviewPreparationHub(baseInput);

  assert.ok(hub.videoLessons.length > 0);
  assert.equal(hub.videoLessons[0].providerStatus, "not-configured");
  assert.equal(hub.videoLessons[0].videoUrl, null);
  assert.match(hub.videoLessons[0].script, /interview context/i);
});

test("handles missing resume without fake readiness", () => {
  const hub = generateInterviewPreparationHub({
    ...baseInput,
    candidate: {
      ...baseInput.candidate,
      skills: [],
      hasResume: false,
      hasUsableResume: false,
    },
  });

  assert.equal(hub.readiness.score, null);
  assert.equal(hub.readiness.primaryCta.href, "/resume");
  assert.ok(hub.weakAreas.some((area) => /resume/i.test(area.title)));
});

test("handles missing profile and target role", () => {
  const hub = generateInterviewPreparationHub({
    ...baseInput,
    candidate: {
      ...baseInput.candidate,
      targetRole: null,
      hasProfile: false,
    },
  });

  assert.equal(hub.readiness.primaryCta.href, "/profile");
  assert.ok(hub.readiness.breakdown.some((item) => item.label === "Role-specific knowledge" && item.value === null));
});

test("generates coding practice without code execution claims", () => {
  const hub = generateInterviewPreparationHub(baseInput);

  assert.ok(hub.codingPractice.length > 0);
  assert.equal(hub.codingPractice[0].externalUrl, null);
  assert.match(hub.codingPractice[0].problem, /Design or implement/i);
});

test("falls back when job data is sparse", () => {
  const hub = generateInterviewPreparationHub({
    ...baseInput,
    job: {
      ...baseInput.job,
      description: "",
      skills: [],
    },
  });

  assert.ok(hub.learningTopics.length > 0);
  assert.ok(hub.questionBank.length > 0);
  assert.ok(hub.preparation.summary.length > 0);
});
