// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { canDecide, canWithdraw, cohortPhase, COMMUNITY_WELCOME, decisionText, parseApplication, parseCohort, parseUuid, slugify } from "./incubator";
import { adminNewApplicationEmail, adminNotifyAddress, applicationDecisionEmail, applicationReceivedEmail, ideaReviewEmail, isReservedAddress, maskEmail, sendEmail } from "./email";

const fd = (o: Record<string, string | string[]>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) for (const x of [v].flat()) f.append(k, x);
  return f;
};
const U = "0b0e6f5c-7c2a-4c1e-9d55-3f7f6c1e2a11";
const U2 = "1b0e6f5c-7c2a-4c1e-9d55-3f7f6c1e2a12";

test("cohortPhase follows status and the ET application window", () => {
  const c = { status: "open", apply_opens_at: "2026-12-01T05:00:00Z", apply_closes_at: "2027-02-01T04:59:00Z" };
  assert.equal(cohortPhase(c, new Date("2026-11-30T23:00:00Z")), "upcoming", "Nov 30, 6 PM ET");
  assert.equal(cohortPhase(c, new Date("2026-12-01T05:00:00Z")), "open", "Dec 1 midnight ET");
  assert.equal(cohortPhase(c, new Date("2027-02-01T04:58:00Z")), "open", "Jan 31, 11:58 PM ET");
  assert.equal(cohortPhase(c, new Date("2027-02-01T04:59:00Z")), "closed");
  assert.equal(cohortPhase({ ...c, status: "draft" }), "draft");
  assert.equal(cohortPhase({ ...c, status: "closed" }, new Date("2027-01-01T00:00:00Z")), "closed", "manual close wins");
  assert.equal(cohortPhase({ ...c, status: "active" }), "running");
  assert.equal(cohortPhase({ status: "open", apply_opens_at: null, apply_closes_at: null }), "open");
});

test("decision rules", () => {
  assert.ok(canDecide("submitted", "accepted") && canDecide("submitted", "under_review") && canDecide("submitted", "declined"));
  assert.ok(canDecide("under_review", "waitlisted") && !canDecide("under_review", "under_review"));
  assert.ok(canDecide("waitlisted", "accepted") && canDecide("waitlisted", "declined") && !canDecide("waitlisted", "under_review"));
  for (const final of ["accepted", "declined", "withdrawn"]) for (const to of ["accepted", "declined", "waitlisted", "under_review"]) assert.equal(canDecide(final, to), false);
  assert.equal(canDecide("submitted", "withdrawn"), false, "withdrawing is the applicant's action");
  assert.ok(canWithdraw("submitted") && canWithdraw("waitlisted") && !canWithdraw("accepted") && !canWithdraw("declined"));
});

test("parseApplication validates and keeps only access needs", () => {
  const ok = parseApplication(fd({ cohort_id: U, project_id: U2, stage: "building", goals: "x".repeat(60), weekly_hours: "12", needs: ["mentorship", "compute_access"], link: "https://github.com/x", ack: "on" }));
  assert.ok(ok.data);
  assert.deepEqual(ok.data!.needs, ["mentorship", "compute_access"]);
  assert.deepEqual(ok.data!.links, { main: "https://github.com/x" });
  const bad = parseApplication(fd({ cohort_id: "1", project_id: "x", stage: "z", goals: "short", weekly_hours: "0", needs: ["small_grant"], link: "javascript:alert(1)" }));
  assert.ok(!bad.data);
  for (const k of ["cohort_id", "project_id", "stage", "goals", "weekly_hours", "needs", "link", "ack"]) assert.ok(bad.state!.fieldErrors![k], k);
  assert.equal(parseUuid(" " + U.toUpperCase() + " "), U);
  assert.equal(parseUuid("42"), null, "legacy integer ids are not accepted for uuid tables");
});

test("parseCohort: ET date-times, date order, open needs a close time", () => {
  const base = { name: "Cohort 1, Spring 2027", format: "virtual", capacity: "10", apply_opens_at: "2026-12-01T00:00", apply_closes_at: "2027-01-31T23:59",
    starts_on: "2027-03-01", ends_on: "2027-05-23", announce_on: "2027-02-26", status: "open" };
  const r = parseCohort(fd(base));
  assert.ok(r.data, r.error);
  assert.equal(r.data!.slug, "cohort-1-spring-2027");
  assert.equal(r.data!.apply_opens_at!.toISOString(), "2026-12-01T05:00:00.000Z");
  assert.equal(r.data!.apply_closes_at!.toISOString(), "2027-02-01T04:59:00.000Z");
  assert.ok(parseCohort(fd({ ...base, apply_closes_at: "" })).error, "open needs a close time");
  assert.ok(parseCohort(fd({ ...base, apply_closes_at: "2026-11-01T00:00" })).error);
  assert.ok(parseCohort(fd({ ...base, ends_on: "2027-02-01" })).error);
  assert.ok(parseCohort(fd({ ...base, capacity: "0" })).error);
  assert.equal(r.data!.capacity, 10, "a soft limit can still be set");
  assert.equal(parseCohort(fd({ ...base, capacity: "" })).data!.capacity, null, "empty = no fixed number of spots");
  assert.ok(parseCohort(fd({ ...base, announce_note: "Accepted participants announced at Tech Con" })).error, "decisions are never public");
  assert.ok(parseCohort(fd({ ...base, status: "bogus" })).error);
  assert.ok(parseCohort(fd({ ...base, starts_on: "2027-02-30x" })).error);
  assert.equal(slugify("  Cohort #2 — Fall 2027!! "), "cohort-2-fall-2027");
});

test("emails: one recipient each, no other member's address, admin notice is link-only", () => {
  const r = applicationReceivedEmail({ to: "a@x.org", name: "Ana", cohortName: "Cohort 1", ideaName: "Idea", announceText: "Decisions are emailed privately to each applicant by Fri, Feb 26, 2027." });
  assert.deepEqual(r.to, ["a@x.org"]);
  assert.match(r.text, /doesn't give out money or equipment/);
  for (const decision of ["accepted", "waitlisted", "declined"] as const) {
    const m = applicationDecisionEmail({ to: "a@x.org", name: "Ana", cohortName: "Cohort 1", decision, note: "See you", startsText: "Mon, Mar 1, 2027" });
    assert.deepEqual(m.to, ["a@x.org"]);
    assert.match(m.text, /See you/);
  }
  const admin = adminNewApplicationEmail({ to: "admin@x.org", cohortId: U });
  assert.match(admin.text, new RegExp(`/admin/incubator/${U}`));
  assert.doesNotMatch(admin.text, /Ana|Idea|@x\.org/);
  const rev = ideaReviewEmail({ to: "o@x.org", ideaName: "My idea", ideaId: U, outcome: "changes_requested", note: "Add details" });
  assert.match(rev.text, /edit/);
  assert.match(rev.text, /Add details/);
});

test("admin notify address defaults to the PANA inbox; test addresses are logged, never sent", async () => {
  const saved = process.env.ADMIN_NOTIFY_EMAIL;
  delete process.env.ADMIN_NOTIFY_EMAIL;
  assert.equal(adminNotifyAddress(), "panagreenllc@gmail.com");
  process.env.ADMIN_NOTIFY_EMAIL = "not an email";
  assert.equal(adminNotifyAddress(), "panagreenllc@gmail.com");
  process.env.ADMIN_NOTIFY_EMAIL = "ops@panagreen.org";
  assert.equal(adminNotifyAddress(), "ops@panagreen.org");
  if (saved === undefined) delete process.env.ADMIN_NOTIFY_EMAIL; else process.env.ADMIN_NOTIFY_EMAIL = saved;
  assert.ok(isReservedAddress("jane+clerk_test@example.com") && isReservedAddress("x@foo.test") && !isReservedAddress("x@gmail.com"));
  assert.equal(maskEmail("jane@example.com"), "ja***@example.com");
  let called = false;
  const res = await sendEmail({ to: ["jane+clerk_test@example.com"], subject: "s", text: "t" }, { apiKey: "re_x", fetchImpl: (async () => { called = true; return new Response("{}"); }) as typeof fetch });
  assert.equal(called, false);
  assert.equal((res as { skipped?: boolean }).skipped, true);
});

test("decisions are private: the text never mentions a public announcement; declined and waitlisted emails welcome people to the community", () => {
  const fmt = (d: string) => d;
  assert.equal(decisionText({ announce_on: "2027-02-26" }, fmt), "Decisions are emailed privately to each applicant by 2027-02-26.");
  assert.equal(decisionText({}, fmt), "Decisions are emailed privately to each applicant.");
  assert.equal(decisionText({ announce_on: null, announce_note: "We may ask a few questions first" }, fmt), "Decisions are emailed privately to each applicant. We may ask a few questions first.");
  assert.match(COMMUNITY_WELCOME, /no fixed number of spots/);
  for (const decision of ["waitlisted", "declined"] as const) {
    const m = applicationDecisionEmail({ to: "a@x.org", name: "Ana", cohortName: "Cohort 1", decision, note: null });
    assert.match(m.text, /community board/);
    assert.doesNotMatch(m.text, /spot opens|tech con/i);
  }
});
