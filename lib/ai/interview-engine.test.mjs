import assert from "node:assert/strict";
import test from "node:test";

import { evaluateInterviewAnswer, generateInterviewSession } from "./interview-engine.ts";

test("evaluates answers against expected coverage without inventing experience", () => {
  const session = generateInterviewSession({
    title: "Frontend Engineer",
    company: "Acme",
    description: "Build web products",
    seniority: "Mid",
    skills: ["React"],
    candidateSkills: ["React"],
    experienceYears: 3,
    targetRole: "Frontend Engineer",
  });
  const question = session.questions.find((item) => item.id === "technical-react-1");
  assert.ok(question);

  const brief = evaluateInterviewAnswer(question, "I would use React.");
  const detailed = evaluateInterviewAnswer(question, "In my project, I defined the component architecture and state management approach. I measured the result and improved rendering performance.");

  assert.ok(detailed.score > brief.score);
  assert.ok(brief.missingPoints.length > detailed.missingPoints.length);
  assert.match(detailed.idealAnswerDirection, /examples from your own experience/i);
});
