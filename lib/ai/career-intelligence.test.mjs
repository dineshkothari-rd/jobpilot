import assert from "node:assert/strict";
import test from "node:test";

import { generateCareerIntelligence } from "./career-intelligence.ts";

const profile = {
  target_role: "Frontend Engineer",
  experience_years: 4,
  location: "Remote",
};

test("generic job-title words do not mix unrelated engineering profiles", () => {
  const roles = ["Mechanical Engineer", "Frontend Engineer", "Sales Manager"];
  const result = generateCareerIntelligence({ profile: { ...profile, target_role: roles[0] }, preferences: null, resume: null,
    jobs: roles.flatMap((title, index) => Array.from({ length: 6 }, (_, n) => ({ id: `${index}-${n}`, title, skills: [index === 0 ? "Thermodynamics" : "React"], description: "", company_name: "Example", location: null, country: null, employment_type: null, seniority: null, salary_min: null, salary_max: null, published_at: null }))), applications: [], savedJobCount: 0 });
  assert.equal(result.marketInsights.sampleSize, 6);
  assert.ok(result.marketInsights.topSkills.some(skill => skill.name === "thermodynamics"));
  assert.ok(!result.marketInsights.topSkills.some(skill => skill.name === "react"));
});

const preferences = {
  preferred_roles: ["Frontend Engineer"],
  preferred_locations: ["Remote"],
  remote_only: true,
  employment_types: ["full-time"],
  minimum_salary: null,
  preferred_countries: [],
};

const resume = {
  file_name: "resume.pdf",
  parsed_data: {
    summary: "Frontend engineer building React and TypeScript products.",
    skills: {
      frontend: ["React", "TypeScript", "JavaScript"],
      backend: ["Node.js"],
      database: ["PostgreSQL"],
      tools: ["Git"],
      other: ["Accessibility"],
    },
    experience: [{ role: "Frontend Engineer" }, { role: "React Engineer" }],
    education: [{ degree: "BS" }],
    projects: [{ name: "Career app" }],
    achievements: ["Improved performance"],
  },
};

const jobs = [
  ["1", "Frontend Engineer", ["React", "TypeScript", "Accessibility"]],
  ["2", "Senior Frontend Engineer", ["React", "TypeScript", "System Design"]],
  ["3", "Frontend Platform Engineer", ["React", "Testing", "Performance"]],
  ["4", "Frontend Developer", ["JavaScript", "React", "GraphQL"]],
  ["5", "React Engineer", ["React", "TypeScript", "Node.js"]],
  ["6", "Frontend Engineer", ["React", "AWS", "Security"]],
].map(([id, title, skills]) => ({
  id,
  title,
  company_name: "Acme",
  description: `${title} role using ${(skills).join(", ")} for web products.`,
  location: "Remote",
  country: null,
  employment_type: "full-time",
  seniority: "Mid",
  salary_min: null,
  salary_max: null,
  skills,
  published_at: "2026-01-01T00:00:00.000Z",
}));

test("calculates complete grounded intelligence", () => {
  const result = generateCareerIntelligence({
    profile,
    preferences,
    resume,
    jobs,
    applications: [{ id: "app-1", job_id: "1", status: "applied", follow_up_at: null }],
    savedJobCount: 2,
  });

  assert.equal(result.targetRole, "Frontend Engineer");
  assert.equal(result.marketInsights.status, "ready");
  assert.ok(result.careerScore.value >= 0 && result.careerScore.value <= 100);
  assert.ok(result.skills.strong.includes("react"));
  assert.ok(result.prioritySkills.some((skill) => skill.name === "system design"));
  assert.match(result.nextBestAction.title, /system design|apply|practice|close/i);
  assert.equal(result.roadmap.length, 3);
});

test("withholds score when target role is missing", () => {
  const result = generateCareerIntelligence({
    profile: { ...profile, target_role: "" },
    preferences: { ...preferences, preferred_roles: [] },
    resume,
    jobs,
    applications: [],
    savedJobCount: 0,
  });

  assert.equal(result.targetRole, null);
  assert.equal(result.careerScore.value, null);
  assert.equal(result.nextBestAction.href, "/profile");
});

test("withholds score when resume is missing", () => {
  const result = generateCareerIntelligence({
    profile,
    preferences,
    resume: null,
    jobs,
    applications: [],
    savedJobCount: 0,
  });

  assert.equal(result.careerScore.value, null);
  assert.equal(result.nextBestAction.href, "/resume");
});

test("marks market data insufficient instead of inventing demand", () => {
  const result = generateCareerIntelligence({
    profile,
    preferences,
    resume,
    jobs: jobs.slice(0, 2),
    applications: [],
    savedJobCount: 0,
  });

  assert.equal(result.marketInsights.status, "insufficient");
  assert.deepEqual(result.marketInsights.topSkills, []);
  assert.equal(result.nextBestAction.href, "/jobs");
});

test("does not fabricate resume skills from malformed input", () => {
  const result = generateCareerIntelligence({
    profile,
    preferences,
    resume: {
      file_name: "bad.pdf",
      parsed_data: {
        skills: { frontend: "React", backend: [42, "Node.js"] },
        experience: "many",
      },
    },
    jobs,
    applications: [],
    savedJobCount: 0,
  });

  assert.deepEqual(result.skills.strong, []);
  assert.ok(result.skills.highPriority.includes("react"));
  assert.ok(result.careerScore.value === null || result.careerScore.value <= 100);
});

test("application momentum changes next action after gaps are closed", () => {
  const coveredResume = {
    ...resume,
    parsed_data: {
      ...resume.parsed_data,
      skills: {
        frontend: ["React", "TypeScript", "JavaScript", "System Design", "Testing", "Performance", "GraphQL"],
        backend: ["Node.js"],
        database: ["PostgreSQL"],
        tools: ["Git", "AWS"],
        other: ["Accessibility", "Security"],
      },
    },
  };

  const result = generateCareerIntelligence({
    profile,
    preferences,
    resume: coveredResume,
    jobs,
    applications: [],
    savedJobCount: 3,
  });

  assert.equal(result.nextBestAction.href, "/jobs");
  assert.match(result.nextBestAction.title, /apply/i);

  const active = generateCareerIntelligence({
    profile,
    preferences,
    resume: coveredResume,
    jobs,
    applications: [{ id: "app-1", job_id: "1", status: "interview", follow_up_at: null }],
    savedJobCount: 3,
  });

  assert.equal(active.nextBestAction.href, "/applications");
  assert.match(active.nextBestAction.title, /practice/i);
});
