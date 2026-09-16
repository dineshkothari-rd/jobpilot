import assert from "node:assert/strict";
import test from "node:test";

import { automaticFollowUp, buildFollowUpMessage } from "./follow-up.ts";

test("builds a stage-aware follow-up without inventing candidate details", () => {
  const message = buildFollowUpMessage({
    status: "screening",
    title: "Frontend Engineer",
    company: "Acme",
    candidateName: null,
  });

  assert.equal(message.subject, "Following up: Frontend Engineer at Acme");
  assert.match(message.body, /updates on next steps/);
  assert.match(message.body, /\[Your name\]$/);
  assert.doesNotMatch(message.body, /interviewed|years of experience/i);
});

test("automatic follow-ups start on first submission, preserve reminders, and stop for closed stages", () => {
  const now = new Date("2026-09-16T10:00:00Z");
  assert.equal(automaticFollowUp("applied", null, null, now), "2026-09-23T10:00:00.000Z");
  assert.equal(automaticFollowUp("saved", null, null, now), null);
  assert.equal(automaticFollowUp("screening", "2026-09-20", null, now), "2026-09-20");
  assert.equal(automaticFollowUp("applied", null, "2026-09-10", now), null);
  for (const status of ["offer", "rejected", "withdrawn"]) {
    assert.equal(automaticFollowUp(status, "2026-09-20", "2026-09-10", now), null);
  }
});
