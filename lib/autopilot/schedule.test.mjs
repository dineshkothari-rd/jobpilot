import assert from "node:assert/strict";
import test from "node:test";
import { authorizedCron, shouldPrepare } from "./schedule.ts";

test("cron fails closed without a valid server secret", () => {
  assert.equal(authorizedCron(null, "secret"), false);
  assert.equal(authorizedCron("Bearer undefined", undefined), false);
  assert.equal(authorizedCron("Bearer wrong", "secret"), false);
  assert.equal(authorizedCron("Bearer secret", "secret"), true);
});

test("regular runs never rebuild prepared or submitted packages", () => {
  assert.equal(shouldPrepare("prepared"), false);
  assert.equal(shouldPrepare("submitted"), false);
  assert.equal(shouldPrepare("failed"), true);
  assert.equal(shouldPrepare(undefined), true);
});
