import assert from "node:assert/strict";
import test from "node:test";

import { buildFollowUpMessage } from "./follow-up.ts";

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
