import assert from "node:assert/strict";
import test from "node:test";

import { generateApplicationCopilot } from "./application-copilot.ts";

test("keeps recommendations grounded in the resume", () => {
  const result = generateApplicationCopilot({
    job: {
      title: "Senior React Engineer",
      company: "Acme",
      description: "Build React and TypeScript products with Firebase.",
      location: "Remote",
      seniority: "Senior",
      employmentType: "Full-time",
      skills: ["React", "TypeScript", "Firebase"],
    },
    candidate: {
      name: "Alex",
      targetRole: "",
      experienceYears: 4,
      location: "Remote",
      skills: ["React", "TypeScript"],
      summary: "Frontend engineer focused on accessible products.",
      experience: [{
        role: "Frontend Engineer",
        company: "Example Co",
        duration: "2022-present",
        descriptions: ["Built React workflows used by recruiting teams."],
      }],
      projects: [],
    },
  });

  assert.equal(result.roleAlignment, "No target role is configured in your profile.");
  assert.deepEqual(result.suggestedKeywords, ["react", "typescript"]);
  assert.deepEqual(result.missingKeywords, ["firebase"]);
  assert.match(result.coverLetter, /Built React workflows used by recruiting teams\./);
  assert.doesNotMatch(result.coverLetter, /Firebase/i);
});
