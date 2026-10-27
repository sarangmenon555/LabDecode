import test from "node:test";
import assert from "node:assert/strict";
import { checkFlag } from "../lib/labs.js";

const CASES = [
  ["12.5 g/dL", "13.0 - 17.0", "outside_range"],
  ["14.2", "13-17", "within_range"],
  ["4,500", "4,000-11,000", "within_range"],
  ["12,500", "4,000-11,000", "outside_range"],
  ["0.4", "<0.5", "within_range"],
  ["0.9", "< 0.5", "outside_range"],
  ["<0.1", "<0.5", "cannot_tell"],
  ["16", "M: 13-17; F: 12-15", "cannot_tell"],
  ["95 %", "", "no_range_given"],
  ["abc", "1-2", "cannot_tell"],
  ["8", ">10", "outside_range"],
  ["5.1", "normal", "cannot_tell"]
];

for (const [value, range, expected] of CASES) {
  test(`value ${value} against range "${range}"`, () => {
    assert.equal(checkFlag(value, range), expected);
  });
}
