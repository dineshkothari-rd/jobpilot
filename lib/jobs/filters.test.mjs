import assert from "node:assert/strict";
import test from "node:test";
import * as filters from "./filters.ts";

test("detectWorkplaceType differentiates remote, hybrid, and on-site roles", () => {
  assert.equal(filters.detectWorkplaceType({ location: "Worldwide", description: "Fully remote position" }), "remote");
  assert.equal(filters.detectWorkplaceType({ location: "Bengaluru", description: "Hybrid role: 2 days in office, 3 days home" }), "hybrid");
  assert.equal(filters.detectWorkplaceType({ location: "Mumbai office", description: "Must work on-site at headquarters" }), "onsite");

  assert.equal(filters.matchesWorkplace({ location: "Hybrid", description: "Hybrid" }, "hybrid"), true);
  assert.equal(filters.matchesWorkplace({ location: "Hybrid", description: "Hybrid" }, "remote"), false);
  assert.equal(filters.matchesWorkplace({ location: "Hybrid", description: "Hybrid" }, "all"), true);
});

test("matchesExperience classifies entry, mid, senior, and lead roles accurately", () => {
  const entryJob = { title: "Junior Web Developer", seniority: "Junior", description: "0-2 years experience" };
  const midJob = { title: "Full Stack Developer", seniority: "Mid", description: "3 years experience with Node" };
  const seniorJob = { title: "Senior Cloud Architect", seniority: "Senior", description: "5+ years cloud engineering" };
  const leadJob = { title: "Staff Software Engineer / Tech Lead", seniority: "Lead", description: "Lead technical roadmap" };

  assert.equal(filters.matchesExperience(entryJob, "entry"), true);
  assert.equal(filters.matchesExperience(entryJob, "senior"), false);

  assert.equal(filters.matchesExperience(midJob, "mid"), true);
  assert.equal(filters.matchesExperience(midJob, "entry"), false);

  assert.equal(filters.matchesExperience(seniorJob, "senior"), true);
  assert.equal(filters.matchesExperience(seniorJob, "entry"), false);

  assert.equal(filters.matchesExperience(leadJob, "lead"), true);
  assert.equal(filters.matchesExperience(leadJob, "entry"), false);

  assert.equal(filters.matchesExperience(seniorJob, "all"), true);
});

test("matchesDatePosted accurately filters publication age windows", () => {
  const now = 1727000000000;
  const posted2HoursAgo = new Date(now - 2 * 60 * 60 * 1000).toISOString();
  const posted3DaysAgo = new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString();
  const posted15DaysAgo = new Date(now - 15 * 24 * 60 * 60 * 1000).toISOString();
  const posted60DaysAgo = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString();

  assert.equal(filters.matchesDatePosted(posted2HoursAgo, "24h", now), true);
  assert.equal(filters.matchesDatePosted(posted2HoursAgo, "7d", now), true);

  assert.equal(filters.matchesDatePosted(posted3DaysAgo, "24h", now), false);
  assert.equal(filters.matchesDatePosted(posted3DaysAgo, "7d", now), true);
  assert.equal(filters.matchesDatePosted(posted3DaysAgo, "30d", now), true);

  assert.equal(filters.matchesDatePosted(posted15DaysAgo, "7d", now), false);
  assert.equal(filters.matchesDatePosted(posted15DaysAgo, "30d", now), true);

  assert.equal(filters.matchesDatePosted(posted60DaysAgo, "30d", now), false);
  assert.equal(filters.matchesDatePosted(posted60DaysAgo, "all", now), true);
});

test("matchesIndustry filters by functional categories", () => {
  const engJob = { title: "Senior Backend Developer", skills: ["Go", "Kubernetes"], description: "APIs" };
  const prodJob = { title: "Technical Product Manager", skills: ["Roadmapping", "Scrum"], description: "Lead sprints" };
  const designJob = { title: "Lead UI/UX Designer", skills: ["Figma"], description: "User flows and wireframes" };
  const dataJob = { title: "Machine Learning Engineer", skills: ["Python", "PyTorch"], description: "LLMs" };
  const salesJob = { title: "Growth Marketing Manager", skills: ["SEO", "AdWords"], description: "Customer acquisition" };
  const opsJob = { title: "People Operations & HR Lead", skills: ["Talent", "Recruiting"], description: "People team" };

  assert.equal(filters.matchesIndustry(engJob, "engineering"), true);
  assert.equal(filters.matchesIndustry(engJob, "design"), false);

  assert.equal(filters.matchesIndustry(prodJob, "product"), true);
  assert.equal(filters.matchesIndustry(designJob, "design"), true);
  assert.equal(filters.matchesIndustry(dataJob, "data"), true);
  assert.equal(filters.matchesIndustry(salesJob, "sales-marketing"), true);
  assert.equal(filters.matchesIndustry(opsJob, "operations"), true);
});

test("matchesSalaryFloor checks minimum compensation bounds", () => {
  assert.equal(filters.matchesSalaryFloor({ salary_min: 80000, salary_max: 120000, salary_currency: "USD" }, 100000), true);
  assert.equal(filters.matchesSalaryFloor({ salary_min: 50000, salary_max: 80000, salary_currency: "USD" }, 100000), false);
  assert.equal(filters.matchesSalaryFloor({ salary_min: null, salary_max: null }, 100000), false);
  assert.equal(filters.matchesSalaryFloor({ salary_min: null, salary_max: null }, 0), true);
  // INR jobs: 1,500,000 INR (15 LPA) matches 100,000 floor (10 LPA)
  assert.equal(filters.matchesSalaryFloor({ salary_min: 1200000, salary_max: 1800000, salary_currency: "INR" }, 100000), true);
  assert.equal(filters.matchesSalaryFloor({ salary_min: 400000, salary_max: 800000, salary_currency: "INR" }, 100000), false);
});
