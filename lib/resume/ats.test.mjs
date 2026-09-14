import assert from "node:assert/strict";
import test from "node:test";

import { analyzeResume, applyResumeSuggestion } from "./ats.ts";

const resume = {
  personalInfo: { name: "Asha", email: "asha@example.com", phone: "+91 9876543210", location: "Pune", github: "", linkedin: "", portfolio: "" },
  summary: "",
  skills: { frontend: ["React", "TypeScript"], backend: [], database: [], tools: [], other: [] },
  experience: [{ company: "Acme", role: "Frontend Engineer", location: "Pune", startDate: "2024", endDate: "Present", description: ["Responsible for building accessible React screens"] }],
  education: [{ degree: "B.Tech", institution: "Example University", location: "", startDate: "2020", endDate: "2024", details: [] }],
  projects: [{ name: "Portfolio", description: ["Built a responsive portfolio"], technologies: ["React"] }],
  achievements: [],
};

test("ATS analysis is deterministic and keeps missing job terms as suggestions", () => {
  const first = analyzeResume(resume, "React TypeScript GraphQL accessibility");
  const second = analyzeResume(resume, "React TypeScript GraphQL accessibility");

  assert.deepEqual(first, second);
  assert.ok(first.matchedKeywords.includes("react"));
  assert.ok(first.missingKeywords.includes("graphql"));
  assert.equal(JSON.stringify(resume).includes("GraphQL"), false);
});

test("safe suggestions rewrite only the referenced existing content", () => {
  const analysis = analyzeResume(resume);
  const bulletSuggestion = analysis.suggestions.find((suggestion) => suggestion.section === "experience");
  assert.ok(bulletSuggestion);

  const updated = applyResumeSuggestion(resume, bulletSuggestion);
  assert.equal(updated.experience[0].description[0], "Worked on building accessible React screens");
  assert.equal(updated.experience[0].company, "Acme");
  assert.equal(resume.experience[0].description[0], "Responsible for building accessible React screens");
});
