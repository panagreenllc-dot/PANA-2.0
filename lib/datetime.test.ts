import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime, currentYear } from "./datetime";

test("formats in America/New_York with ET label", () => {
  assert.equal(formatDateTime("2026-10-19T23:31:34Z"), "Oct 19, 2026, 7:31 PM ET");
  assert.equal(formatDate("2026-10-20T02:00:00Z"), "Oct 19, 2026", "late-evening ET stays on the ET date");
  assert.equal(formatDateTime("2026-01-15T17:05:00Z"), "Jan 15, 2026, 12:05 PM ET", "EST in winter");
  assert.equal(formatDateTime(null), "");
  assert.equal(formatDate("garbage"), "");
  assert.equal(currentYear(new Date("2027-01-01T03:00:00Z")), 2026);
});
