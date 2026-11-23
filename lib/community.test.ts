// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildIcs, canModerate, digestState, initialStatus, mapsUrl, parseAgendaLines, parseFeedPost, parseMemberPost, parseReply, parseSpeakerLines,
  agendaToLines, speakersToLines, DIGEST_INTERVAL_DAYS,
} from "./community";
import { formatEventRange, parseEasternLocal, toEasternLocalInput } from "./datetime";
import { communityDigestEmail, boardDecisionEmail, adminBoardReviewEmail } from "./email";

const fd = (o: Record<string, string>) => { const f = new FormData(); for (const [k, v] of Object.entries(o)) f.append(k, v); return f; };
const sp = (s: string) => s.replace(/[\u202f\u00a0]/g, " ");
const post = { kind: "question", title: "Anyone tried a 3D printer?", body: "Looking for tips on getting started with 3D printing for prototypes." };

test("member posts: valid input, kinds and lengths", () => {
  assert.deepEqual(parseMemberPost(fd(post)).data, post);
  assert.ok(parseMemberPost(fd({ ...post, kind: "sale" })).error);
  assert.ok(parseMemberPost(fd({ ...post, title: "Hey" })).error);
  assert.ok(parseMemberPost(fd({ ...post, body: "too short" })).error);
  assert.ok(parseMemberPost(fd({ ...post, body: "x".repeat(2001) })).error);
});

test("member posts and replies block contact details and money amounts", () => {
  for (const bad of ["email me at sam@example.com please thanks", "call me on (772) 555-0134 any time ok", "I can pay $500 for a logo design here", "selling this laptop for 300 dollars cheap"]) {
    assert.ok(parseMemberPost(fd({ ...post, body: bad })).error, bad);
    assert.ok(parseReply(fd({ body: bad })).error, bad);
  }
  assert.ok(parseMemberPost(fd({ ...post, title: "Email sam@example.com" })).error, "title is checked too");
  assert.equal(parseReply(fd({ body: "Try the library makerspace, they helped me." })).data, "Try the library makerspace, they helped me.");
  assert.ok(parseReply(fd({ body: "a" })).error);
});

test("moderation rule: first contribution waits, then trusted", () => {
  assert.equal(initialStatus(false), "pending");
  assert.equal(initialStatus(true), "published");
  assert.ok(canModerate("pending", "approve") && canModerate("pending", "decline"));
  assert.ok(!canModerate("published", "approve"));
  assert.ok(canModerate("published", "remove") && canModerate("removed", "restore"));
  assert.ok(!canModerate("published", "restore"));
});

test("Eastern times round-trip across daylight saving", () => {
  assert.equal(parseEasternLocal("2027-05-30T10:30")?.toISOString(), "2027-05-30T14:30:00.000Z");
  assert.equal(parseEasternLocal("2027-01-15T10:30")?.toISOString(), "2027-01-15T15:30:00.000Z");
  assert.equal(parseEasternLocal("nope"), null);
  assert.equal(toEasternLocalInput("2027-05-30T21:00:00Z"), "2027-05-30T17:00");
  // 2027 changeovers: Mar 14 (spring forward at 2 AM) and Nov 7 (fall back at 2 AM).
  assert.equal(parseEasternLocal("2027-03-14T01:30")?.toISOString(), "2027-03-14T06:30:00.000Z");
  assert.equal(parseEasternLocal("2027-03-14T03:30")?.toISOString(), "2027-03-14T07:30:00.000Z");
  assert.equal(parseEasternLocal("2027-03-14T02:30")?.toISOString(), "2027-03-14T06:30:00.000Z", "gap time moves forward an hour (3:30 AM EDT)");
  assert.equal(parseEasternLocal("2027-11-07T00:30")?.toISOString(), "2027-11-07T04:30:00.000Z");
  assert.equal(parseEasternLocal("2027-11-07T03:00")?.toISOString(), "2027-11-07T08:00:00.000Z");
});

test("Tech Con time shows as Sunday, May 30, 2027, 10:30 AM – 5:00 PM ET", () => {
  const r = formatEventRange("2027-05-30T14:30:00Z", "2027-05-30T21:00:00Z");
  assert.equal(r.day, "Sunday, May 30, 2027");
  assert.equal(sp(r.time), "10:30 AM – 5:00 PM ET");
  assert.deepEqual(formatEventRange(null), { day: "", time: "" });
});

test("feed posts: events need a start, end after start, https links, ET parsing, lists", () => {
  const base = { kind: "event", title: "Spring meetup", body: "Come meet the community.", starts_at: "2027-04-10T18:00", ends_at: "2027-04-10T20:00",
    agenda: "6:00 PM | Doors open\n6:30 PM | Lightning talks\n\n", speakers: "Ada Lovelace | Keynote\nGrace Hopper", price_text: "Free" };
  const ok = parseFeedPost(fd(base)).data!;
  assert.equal(ok.slug, "spring-meetup");
  assert.equal(ok.starts_at?.toISOString(), "2027-04-10T22:00:00.000Z");
  assert.deepEqual(ok.agenda, [{ time_label: "6:00 PM", title: "Doors open" }, { time_label: "6:30 PM", title: "Lightning talks" }]);
  assert.deepEqual(ok.speakers, [{ name: "Ada Lovelace", role: "Keynote" }, { name: "Grace Hopper", role: "" }]);
  assert.equal(ok.registration_url, null, "no link yet is fine");
  assert.ok(parseFeedPost(fd({ ...base, starts_at: "" })).error);
  assert.ok(parseFeedPost(fd({ ...base, ends_at: "2027-04-10T17:00" })).error);
  assert.ok(parseFeedPost(fd({ ...base, registration_url: "javascript:alert(1)" })).error);
  assert.equal(parseFeedPost(fd({ ...base, registration_url: "https://example.com/reg" })).data?.registration_url, "https://example.com/reg");
  const ann = parseFeedPost(fd({ kind: "announcement", title: "Welcome!", starts_at: "", agenda: "x | y" })).data!;
  assert.equal(ann.kind, "announcement");
  assert.deepEqual(ann.agenda, [], "agenda only for events");
});

test("agenda and speaker lines round-trip", () => {
  const a = parseAgendaLines("10:30 AM | Doors\nKeynote");
  assert.equal(agendaToLines(a), "10:30 AM | Doors\nKeynote");
  const s = parseSpeakerLines("Professor Joseph Ali | Keiser University · Guest speaker");
  assert.equal(speakersToLines(s), "Professor Joseph Ali | Keiser University · Guest speaker");
});

test("digest: at most one every 14 days, batches at most daily", () => {
  const now = new Date("2027-01-20T12:00:00Z");
  assert.deepEqual(digestState(null, now), { canStart: true, canContinue: false, nextStart: null });
  const recent = digestState({ created_at: "2027-01-10T12:00:00Z", last_batch_at: "2027-01-10T12:00:00Z", remaining: 0 }, now);
  assert.equal(recent.canStart, false);
  assert.equal(recent.nextStart?.toISOString(), new Date(Date.parse("2027-01-10T12:00:00Z") + DIGEST_INTERVAL_DAYS * 86400000).toISOString());
  assert.equal(digestState({ created_at: "2027-01-01T00:00:00Z", last_batch_at: null, remaining: 0 }, now).canStart, true);
  const unfinished = digestState({ created_at: "2027-01-01T00:00:00Z", last_batch_at: "2027-01-20T01:00:00Z", remaining: 40 }, now);
  assert.deepEqual([unfinished.canStart, unfinished.canContinue], [false, false]);
  assert.equal(digestState({ created_at: "2027-01-01T00:00:00Z", last_batch_at: "2027-01-19T01:00:00Z", remaining: 40 }, now).canContinue, true);
});

test("calendar file is valid RFC 5545 in UTC with folded lines and escaped text", () => {
  const ics = buildIcs({ uid: "abc", title: "Treasure Coast Tech Con 2027", starts_at: new Date("2027-05-30T14:30:00Z"), ends_at: new Date("2027-05-30T21:00:00Z"),
    location: "Havert L. Fenn Center, 2000 Virginia Avenue; Fort Pierce", description: "x".repeat(200), url: "https://panagreen.org/techcon" }, new Date("2026-11-22T00:00:00Z"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n") && ics.endsWith("END:VCALENDAR\r\n"));
  assert.match(ics, /DTSTART:20270530T143000Z\r\n/);
  assert.match(ics, /DTEND:20270530T210000Z\r\n/);
  assert.match(ics, /LOCATION:Havert L\. Fenn Center\\, 2000 Virginia Avenue\\; Fort Pierce/);
  for (const line of ics.split("\r\n")) assert.ok(line.length <= 75, line);
  assert.ok(mapsUrl("Havert L. Fenn Center", "2000 Virginia Avenue").startsWith("https://www.google.com/maps/search/?api=1&query=Havert%20L."));
});

test("board and digest emails carry links, not member emails", () => {
  const d = communityDigestEmail({ to: "m@example.com", items: [{ title: "Tech Con", when: "Sunday, May 30, 2027", url: "https://panagreen.org/techcon" }] });
  assert.match(d.text, /\/me#email/);
  assert.doesNotMatch(d.text, /@/, "no addresses in the body");
  const a = adminBoardReviewEmail({ to: "admin@example.com" });
  assert.doesNotMatch(a.text, /@/, "link-only notice");
  const b = boardDecisionEmail({ to: "m@example.com", title: "My post", decision: "declined", note: "Please remove the price", url: "https://panagreen.org/community/board/x" });
  assert.match(b.text, /Please remove the price/);
});
