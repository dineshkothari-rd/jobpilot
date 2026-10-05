import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire, Module } from "node:module";
import ts from "typescript";

// Load lib/jobs/sync.ts bypassing server-only
const require = createRequire(import.meta.url);
const loadedSync = new Module(import.meta.filename);
loadedSync.require = (name) => {
  if (name === "server-only") return {};
  if (name === "@/lib/utils") {
    return {
      safeExternalUrl: (url) => url,
    };
  }
  return require(name);
};
const syncSource = readFileSync(new URL("../jobs/sync.ts", import.meta.url), "utf8");
loadedSync._compile(
  ts.transpileModule(syncSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  import.meta.filename,
);
const sync = loadedSync.exports;

// Load lib/matching/scorer.ts
const loadedScorer = new Module(import.meta.filename);
const scorerSource = readFileSync(new URL("./scorer.ts", import.meta.url), "utf8");
loadedScorer._compile(
  ts.transpileModule(scorerSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText,
  import.meta.filename,
);
const scorer = loadedScorer.exports;

test("detectIndiaLocation accurately identifies Indian tech hubs and variants", () => {
  assert.deepEqual(sync.detectIndiaLocation("Bengaluru, Karnataka, India"), { isIndia: true, city: "Bengaluru" });
  assert.deepEqual(sync.detectIndiaLocation("Bangalore Urban"), { isIndia: true, city: "Bengaluru" });
  assert.deepEqual(sync.detectIndiaLocation("Hyderabad, Telangana"), { isIndia: true, city: "Hyderabad" });
  assert.deepEqual(sync.detectIndiaLocation("Gurugram, Haryana"), { isIndia: true, city: "Delhi-NCR" });
  assert.deepEqual(sync.detectIndiaLocation("Noida, Uttar Pradesh"), { isIndia: true, city: "Delhi-NCR" });
  assert.deepEqual(sync.detectIndiaLocation("Pune, Maharashtra, India"), { isIndia: true, city: "Pune" });
  assert.deepEqual(sync.detectIndiaLocation("Mumbai, India"), { isIndia: true, city: "Mumbai" });
  assert.deepEqual(sync.detectIndiaLocation("Chennai (Madras)"), { isIndia: true, city: "Chennai" });
  assert.deepEqual(sync.detectIndiaLocation("Remote, India"), { isIndia: true });
  assert.deepEqual(sync.detectIndiaLocation("San Francisco, CA"), { isIndia: false });
  assert.deepEqual(sync.detectIndiaLocation("London, UK"), { isIndia: false });
  assert.deepEqual(sync.detectIndiaLocation(null), { isIndia: false });
});

test("parseSalaryString handles Indian LPA and Lakhs compensation formats", () => {
  assert.deepEqual(sync.parseSalaryString("15 LPA"), { min: 1500000, max: null, currency: "INR" });
  assert.deepEqual(sync.parseSalaryString("12-18 LPA"), { min: 1200000, max: 1800000, currency: "INR" });
  assert.deepEqual(sync.parseSalaryString("14.5 LPA"), { min: 1450000, max: null, currency: "INR" });
  assert.deepEqual(sync.parseSalaryString("₹20L - ₹35L"), { min: 2000000, max: 3500000, currency: "INR" });
  assert.deepEqual(sync.parseSalaryString("18 Lakhs"), { min: 1800000, max: null, currency: "INR" });
  assert.deepEqual(sync.parseSalaryString("₹12,00,000 - ₹18,00,000"), { min: 1200000, max: 1800000, currency: "INR" });
});

test("calculateMatchScore scores Indian city aliases and country preferences correctly", () => {
  const profile = {
    target_role: "Software Engineer",
    experience_years: 4,
    location: "Bangalore",
    skills: ["React", "TypeScript", "Node.js"],
  };

  const preferences = {
    preferred_roles: ["Software Engineer"],
    preferred_locations: ["Bangalore"],
    remote_only: false,
    employment_types: ["full-time"],
    minimum_salary: 1500000,
    preferred_countries: ["India"],
  };

  // Job listed with canonical "Bengaluru, India" instead of "Bangalore"
  const job = {
    title: "Software Engineer",
    description: "Build frontend with React and TypeScript in our Bengaluru office.",
    location: "Bengaluru, India",
    country: "India",
    employment_type: "full-time",
    seniority: "Mid-Senior",
    salary_min: 1500000,
    salary_max: 2200000,
    skills: ["React", "TypeScript", "Node.js"],
  };

  const result = scorer.calculateMatchScore(job, profile, preferences);
  assert.ok(result.score >= 80, `Expected high match score, got ${result.score}`);
  assert.equal(result.breakdown.location, 15, "City alias Bangalore/Bengaluru should get full 15 location points");
  assert.equal(result.breakdown.country, 5, "India preference should get full 5 country points");
});
