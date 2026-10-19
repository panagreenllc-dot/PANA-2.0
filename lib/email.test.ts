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
  const ok = await sendEmail(msg, { apiKey: "re_test", fetchImpl: (async (_u: string, init: RequestInit) => {
    body = JSON.parse(String(init.body)); auth = String((init.headers as Record<string, string>).Authorization);
    return new Response(JSON.stringify({ id: "em_1" }), { status: 200 });
  }) as unknown as typeof fetch });
  assert.deepEqual(ok, { ok: true, id: "em_1" });
  assert.equal(body.from, DEFAULT_FROM);
  assert.equal(auth, "Bearer re_test");
  const bad = await sendEmail(msg, { apiKey: "re_test", fetchImpl: (async () => new Response("nope", { status: 422 })) as typeof fetch });
  assert.equal(bad.ok, false);
  const boom = await sendEmail(msg, { apiKey: "re_test", fetchImpl: (async () => { throw new Error("net"); }) as typeof fetch });
  assert.equal(boom.ok, false);
});

test("introduction goes to both parties and escapes HTML", () => {
  const m = introductionEmail({ ownerEmail: "o@x.com", ownerName: "<b>O</b>", requesterEmail: "q@x.com", requesterName: "Q", ideaName: "Idea", ideaId: "1", message: "hi" });
  assert.deepEqual([...m.to].sort(), ["o@x.com", "q@x.com"]);
  assert.ok(!m.html?.includes("<b>O</b>"));
  assert.equal(escapeHtml("<&>\""), "&lt;&amp;&gt;&quot;");
});
