import { test } from "node:test";
import assert from "node:assert/strict";
import { sendEmail, introductionEmail, escapeHtml, DEFAULT_FROM } from "./email";

const msg = { to: ["a@example.com"], subject: "Hi", text: "Hello" };

test("missing RESEND_API_KEY skips without throwing", async () => {
  const saved = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;
  let called = false;
  const r = await sendEmail(msg, { fetchImpl: (async () => { called = true; return new Response("{}"); }) as typeof fetch });
  assert.equal(r.ok, false);
  assert.equal((r as { skipped?: boolean }).skipped, true);
  assert.equal(called, false);
  if (saved) process.env.RESEND_API_KEY = saved;
});

test("sends via Resend with from address and returns id; errors don't throw", async () => {
  let body: Record<string, unknown> = {};
  let auth = "";
  const ok = await sendEmail(msg, { apiKey: "re_test", allowReserved: true, fetchImpl: (async (_u: string, init: RequestInit) => {
    body = JSON.parse(String(init.body)); auth = String((init.headers as Record<string, string>).Authorization);
    return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
  }) as unknown as typeof fetch });
  assert.deepEqual(ok, { ok: true, id: "em_1" });
  assert.equal(body.from, DEFAULT_FROM);
  assert.equal(auth, "Bearer re_test");
  const bad = await sendEmail(msg, { apiKey: "re_test", allowReserved: true, fetchImpl: (async () => new Response("nope", { status: 422 })) as typeof fetch });
  assert.equal(bad.ok, false);
  const boom = await sendEmail(msg, { apiKey: "re_test", allowReserved: true, fetchImpl: (async () => { throw new Error("net"); }) as typeof fetch });
  assert.equal(boom.ok, false);
});

test("introduction goes to both parties and escapes HTML", () => {
  const m = introductionEmail({ ownerEmail: "o@x.com", ownerName: "<b>O</b>", requesterEmail: "q@x.com", requesterName: "Q", ideaName: "Idea", ideaId: "1", message: "hi" });
  assert.deepEqual([...m.to].sort(), ["o@x.com", "q@x.com"]);
  assert.ok(!m.html?.includes("<b>O</b>"));
  assert.equal(escapeHtml("<&>\""), "&lt;&amp;&gt;&quot;");
});

test("P3-2b notices share no addresses; only the introduction does", async () => {
  const E = await import("./email");
  const help = E.helpOfferNoticeEmail({ to: ["owner@x.org"], ideaName: "Idea", needTitle: "A mentor", helperName: "Sam", onBehalfOf: "IRSC", message: "I can help weekly.", url: "https://panagreen.org/me/requests/help/1" });
  assert.ok(!help.text.includes("@") && !help.replyTo, "no addresses in the notice");
  assert.ok(help.text.includes("for IRSC"));
  const adm = E.offerRequestNoticeEmail({ to: ["admin@x.org"], offerTitle: "Lab", partnerName: "Library", requesterName: "Secret Name", message: "secret note", url: "u", forAdmin: true });
  assert.ok(!adm.text.includes("Secret Name") && !adm.text.includes("secret note"), "admin notice is link-only");
  const intro = E.requestIntroEmail({ a: { email: "a@x.org", name: "A" }, b: { email: "b@x.org", name: "B" }, subject: "s", opening: "o", message: "m", url: "u" });
  assert.deepEqual(intro.to, ["a@x.org", "b@x.org"]);
  assert.ok(intro.text.includes("a@x.org") && intro.text.includes("b@x.org"));
  const pn = E.partnerNoticeEmail({ to: ["c@x.org"], partnerName: "Library", subject: "s", line: "Your offer is live." });
  assert.ok(pn.text.includes("/partner") && !pn.text.includes("c@x.org"));
  assert.ok(!E.adminPartnerUpdateEmail({ to: "admin@x.org", what: "offer" }).text.includes("admin@x.org"));
  const nr = E.needReviewEmail({ to: "o@x.org", needTitle: "A mentor", ideaName: "Idea", ideaId: "abc", outcome: "changes_requested", note: "Be specific" });
  assert.ok(nr.text.includes("Be specific") && nr.text.includes("/ideas/abc#needs"));
});

test("P3-2b: notices carry no addresses; only the introduction shares both", async () => {
  const E = await import("./email");
  const notice = E.helpOfferNoticeEmail({ to: ["owner@x.org"], ideaName: "App", needTitle: "Designer", helperName: "Sam", onBehalfOf: "IRSC", message: "I can help.", url: "https://panagreen.org/me/requests/help/1" });
  assert.ok(!notice.text.includes("@") && notice.text.includes("for IRSC"));
  const req = E.offerRequestNoticeEmail({ to: ["c@x.org"], offerTitle: "Lab", partnerName: "Library", requesterName: "Sam", message: "Two evenings please.", url: "u" });
  assert.ok(!req.text.includes("@"));
  const admin = E.offerRequestNoticeEmail({ to: ["a@x.org"], offerTitle: "Lab", partnerName: "Library", requesterName: "Sam", message: "secret note", url: "u", forAdmin: true });
  assert.ok(!admin.text.includes("Sam") && !admin.text.includes("secret note"), "admin notice is link-only");
  const intro = E.requestIntroEmail({ a: { email: "a@x.org", name: "A" }, b: { email: "b@x.org", name: "B" }, subject: "s", opening: "o", message: "m", url: "u" });
  assert.deepEqual(intro.to, ["a@x.org", "b@x.org"]);
  assert.ok(intro.text.includes("a@x.org") && intro.text.includes("b@x.org"));
  const ap = E.adminPartnerUpdateEmail({ to: "a@x.org", what: "offer" });
  assert.ok(!ap.text.includes("@"));
});
