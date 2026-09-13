import assert from "node:assert/strict";
import test from "node:test";

import { getTimeOfDayGreeting } from "./greeting.ts";

const cases = [
  [4, 59, "Good night"],
  [5, 0, "Good morning"],
  [11, 59, "Good morning"],
  [12, 0, "Good afternoon"],
  [16, 59, "Good afternoon"],
  [17, 0, "Good evening"],
  [20, 59, "Good evening"],
  [21, 0, "Good night"],
  [23, 59, "Good night"],
];

test("returns the correct greeting at each boundary", () => {
  for (const [hour, minute, expected] of cases) {
    const date = new Date(2026, 0, 1, hour, minute);
    assert.equal(getTimeOfDayGreeting(date), expected, `${hour}:${minute}`);
  }
});
