import { test } from "node:test";
import assert from "node:assert/strict";
import { formatDate, formatDateTime, currentYear, formatDay, parseEasternLocal, toEasternLocalInput } from "./datetime";

test("formats in America/New_York with ET label", () => {
  assert.equal(formatDateTime("2026-10-19T23:31:34Z"), "Oct 19, 2026, 7:31 PM ET");
  assert.equal(formatDate("2026-10-20T02:00:00Z"), "Oct 19, 2026", "late-evening ET stays on the ET date");
  assert.equal(formatDateTime("2026-01-15T17:05:00Z"), "Jan 15, 2026, 12:05 PM ET", "EST in winter");
  assert.equal(formatDateTime(null), "");
  assert.equal(formatDate("garbage"), "");
  assert.equal(currentYear(new Date("2027-01-01T03:00:00Z")), 2026);
});

test("formatDay never shifts calendar days", () => {
  assert.equal(formatDay("2027-03-01"), "Mon, Mar 1, 2027");
  assert.equal(formatDay("2027-02-21"), "Sun, Feb 21, 2027");
  assert.equal(formatDay(null), "");
  assert.equal(formatDay("2027-3-1"), "");
});

test("parseEasternLocal: EST, EDT and the DST changeovers", () => {
  assert.equal(parseEasternLocal("2026-12-01T00:00")!.toISOString(), "2026-12-01T05:00:00.000Z", "EST");
  assert.equal(parseEasternLocal("2027-01-31T23:59")!.toISOString(), "2027-02-01T04:59:00.000Z", "late-night EST stays on the ET date");
  assert.equal(parseEasternLocal("2027-06-01T09:30")!.toISOString(), "2027-06-01T13:30:00.000Z", "EDT");
  assert.equal(parseEasternLocal("2027-03-14T01:59")!.toISOString(), "2027-03-14T06:59:00.000Z", "just before spring forward");
  assert.equal(parseEasternLocal("2027-03-14T03:00")!.toISOString(), "2027-03-14T07:00:00.000Z", "just after spring forward");
  assert.equal(parseEasternLocal("2027-03-14T02:30")!.toISOString(), "2027-03-14T06:30:00.000Z", "gap time moves forward (= 3:30 EDT)");
  assert.equal(parseEasternLocal("2027-11-07T00:30")!.toISOString(), "2027-11-07T04:30:00.000Z", "before fall back");
  assert.equal(parseEasternLocal("2027-11-07T03:00")!.toISOString(), "2027-11-07T08:00:00.000Z", "after fall back");
  for (const bad of ["", "2027-13-01T00:00", "2027-01-01", "nope", null, 5]) assert.equal(parseEasternLocal(bad), null);
});

test("toEasternLocalInput round-trips", () => {
  for (const s of ["2026-12-01T00:00", "2027-01-31T23:59", "2027-07-04T12:15"]) assert.equal(toEasternLocalInput(parseEasternLocal(s)), s);
  assert.equal(toEasternLocalInput(null), "");
});
