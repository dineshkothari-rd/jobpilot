import assert from "node:assert/strict";
import test from "node:test";
import { homeNextAction } from "./home-next-action.ts";

test("home prioritizes setup, resume, due follow-up and prepared application before job discovery", () => {
  const input = { needsSetup: true, hasResume: false, dueJobId: "due/job", readyJobId: "ready/job", hasMatches: true };
  assert.equal(homeNextAction(input).href, "/profile");
  input.needsSetup = false;
  assert.equal(homeNextAction(input).href, "/resume");
  input.hasResume = true;
  assert.equal(homeNextAction(input).href, "/applications?jobId=due%2Fjob");
  delete input.dueJobId;
  assert.equal(homeNextAction(input).href, "/applications?jobId=ready%2Fjob");
  delete input.readyJobId;
  assert.equal(homeNextAction(input).cta, "Review job matches");
  input.hasMatches = false;
  assert.equal(homeNextAction(input).cta, "Find jobs");
});
