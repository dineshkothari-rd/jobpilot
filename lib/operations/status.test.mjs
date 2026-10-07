import assert from "node:assert/strict";
import test from "node:test";
import { workerResult, workerHealth } from "./status.ts";
test("worker summaries omit secrets/private text and distinguish failure, skip, incomplete, abandoned and overdue", () => {
  assert.deepEqual(workerResult(200, { sent: 3, failed: 0, skipped: 2, error: "secret", user_id: "private" }), { state: "succeeded", completed: 3, failed: 0, skipped: 2 });
  assert.equal(workerResult(503, { incomplete: true }).state, "incomplete");
  assert.equal(workerResult(200, { failed: 1 }).state, "failed");
  assert.equal(workerResult(200, { skipped: "Provider missing" }).state, "skipped");
  assert.deepEqual(workerResult(200, { sent: Infinity, failed: -1 }), { state: "succeeded", completed: 0, failed: 0, skipped: 0 });
  assert.equal(workerResult(200, { sent: Number.MAX_SAFE_INTEGER, completed: Number.MAX_SAFE_INTEGER }).completed, 2147483647);
  const now = Date.now();
  assert.equal(workerHealth(undefined, now), "never_run");
  assert.equal(workerHealth({ state: "running", started_at: new Date(now - 601000).toISOString() }, now), "abandoned");
  assert.equal(workerHealth({ state: "succeeded", started_at: new Date(now - 37 * 3600000).toISOString() }, now), "overdue");
  assert.equal(workerHealth({ state: "failed", started_at: new Date(now).toISOString() }, now), "failed");
});
