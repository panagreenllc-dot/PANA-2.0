// Run: npm test. Migration 011 + the shipped P3-2b SQL (needs, help offers, offer requests, partner contacts) on PGlite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { loadMigrations, runMigrations } from "./migrate.mjs";
import * as N from "../lib/needs-sql.ts";
import * as Q from "../lib/requests-sql.ts";
import * as P from "../lib/partner-portal-sql.ts";
import { BROWSE_SQL } from "../lib/idea-sql.ts";

async function db({ upTo } = {}) {
  const pg = new PGlite();
  const d = { query: async (t, p) => (await pg.query(t, p)).rows, exec: async (t) => { await pg.exec(t); } };
  await d.exec(readFileSync(new URL("./schema-baseline.sql", import.meta.url), "utf8"));
  const all = loadMigrations();
  await runMigrations(d, upTo ? all.filter((m) => m.version <= upTo) : all, { log: () => {} });
  return { pg, d };
}

async function fixture() {
  const { pg, d } = await db();
  for (const u of ["owner", "helper", "h2", "staff", "admin"]) {
    await d.query("INSERT INTO members (user_id, email, display_name, status, terms_accepted_at) VALUES ($1, $2, $3, 'active', now())", [u, `${u}@example.com`, `${u} Person`]);
  }
  const idea = async (o = {}) => (await d.query(
    `INSERT INTO projects (user_id, name, project_name, category, description, status, audience, hidden_by_reports)
     VALUES ($1, 'Owner', $2, 'AI', 'A useful description for testing.', $3, $4, $5) RETURNING id::text AS id`,
    [o.user ?? "owner", o.name ?? "Idea", o.status ?? "approved", o.audience ?? "public", o.hidden ?? false]))[0].id;
  const need = async (ideaId, o = {}) => (await d.query(N.NEED_INSERT_SQL, [ideaId, o.owner ?? "owner", o.kind ?? "mentorship", o.title ?? "A mentor", null, null, 5]))[0]?.id;
  const approve = (id) => d.query(N.NEED_REVIEW_SQL, [id, "approve", "admin", null]);
  const partner = async (o = {}) => (await d.query(
    "INSERT INTO partners (slug, name, kind, status, public_listing) VALUES ($1, $2, 'library', $3, true) RETURNING id::text AS id",
    [o.slug ?? `p-${Math.random().toString(36).slice(2, 8)}`, o.name ?? "Test Library", o.status ?? "approved"]))[0].id;
  const offer = async (pid, o = {}) => (await d.query(
    `INSERT INTO resource_offers (partner_id, type, title, eligibility, claim_method, status) VALUES ($1, 'lab_hours', 'Lab time', 'members', $2, $3) RETURNING id::text AS id`,
    [pid, o.claim ?? "request_via_pana", o.status ?? "published"]))[0].id;
  return { pg, d, idea, need, approve, partner, offer };
}

test("011 is additive: applies on top of 001-010, leaves domino_* and existing tables as they were (plus one nullable column)", async () => {
  const { pg, d } = await db({ upTo: "010" });
  const shape = async () => JSON.stringify(await d.query(
    `SELECT table_name, column_name, data_type, is_nullable, column_default FROM information_schema.columns
     WHERE table_schema = 'public' AND (table_name LIKE 'domino_%' OR table_name IN ('members', 'projects', 'reports', 'collaboration_requests',
       'resource_offers', 'incubator_cohorts', 'incubator_applications', 'incubator_credentials', 'partner_inquiries', 'profiles'))
     ORDER BY table_name, column_name`));
  const cons = async () => JSON.stringify(await d.query(
    `SELECT conrelid::regclass::text AS t, conname, pg_get_constraintdef(oid) AS def FROM pg_constraint
     WHERE conrelid::regclass::text LIKE 'domino_%' OR conrelid::regclass::text IN ('members', 'projects', 'reports', 'collaboration_requests', 'resource_offers', 'partners') ORDER BY 1, 2`));
  const partnerCols = async () => (await d.query("SELECT column_name FROM information_schema.columns WHERE table_name = 'partners' ORDER BY 1")).map((r) => r.column_name);
  const before = [await shape(), await cons()];
  const pBefore = await partnerCols();
  await runMigrations(d, loadMigrations(), { log: () => {} });
  assert.deepEqual([await shape(), await cons()], before);
  assert.deepEqual((await partnerCols()).filter((c) => c !== "pending_changes"), pBefore);
  const [pc] = await d.query("SELECT is_nullable, column_default FROM information_schema.columns WHERE table_name = 'partners' AND column_name = 'pending_changes'");
  assert.deepEqual(pc, { is_nullable: "YES", column_default: null });
  const tables = (await d.query("SELECT table_name FROM information_schema.tables WHERE table_name IN ('project_needs','help_offers','offer_requests','partner_contacts') ORDER BY 1")).map((r) => r.table_name);
  assert.deepEqual(tables, ["help_offers", "offer_requests", "partner_contacts", "project_needs"]);
  assert.deepEqual(await runMigrations(d, loadMigrations(), { log: () => {} }), [], "idempotent");
  const cols = (await d.query("SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('project_needs','help_offers','offer_requests','partner_contacts')")).map((r) => r.column_name);
  assert.ok(!cols.filter((c) => c !== "intro_email_id").some((c) => /email|phone|price|dollar|grant/.test(c)), "no contact or money columns (intro_email_id is the provider message id)");
  await pg.close();
});

test("constraints: need kinds, lengths, no self-help, one open offer per helper", async () => {
  const { pg, d, idea, need, approve } = await fixture();
  const i = await idea();
  await assert.rejects(d.query(N.NEED_INSERT_SQL, [i, "owner", "cash", "Money please", null, null, 5]), "no money kind");
  await assert.rejects(d.query(N.NEED_INSERT_SQL, [i, "owner", "mentorship", "x", null, null, 5]), "title too short");
  const n = await need(i);
  await approve(n);
  await assert.rejects(d.query("INSERT INTO help_offers (need_id, helper_user_id, owner_user_id, message) VALUES ($1, 'owner', 'owner', 'hi')", [n]), "no self-help");
  assert.ok((await d.query(Q.HELP_INSERT_SQL, [n, "helper", "I can mentor you every week.", null]))[0]);
  assert.equal((await d.query(Q.HELP_INSERT_SQL, [n, "helper", "Again, I can mentor you.", null])).length, 0, "one open offer per helper");
  await pg.close();
});

test("needs: only the owner adds, max 5 active, review, edits go back to review, owner status moves", async () => {
  const { pg, d, idea, need, approve } = await fixture();
  const i = await idea();
  assert.equal(await need(i, { owner: "helper" }), undefined, "only the idea's owner");
  const ids = [];
  for (let k = 0; k < 5; k++) ids.push(await need(i, { title: `Need ${k}` }));
  assert.equal(await need(i, { title: "Sixth" }), undefined, "max 5 active");
  await d.query(N.NEED_OWNER_STATUS_SQL, [ids[0], "owner", "closed", "pending"]);
  assert.ok(await need(i, { title: "Sixth" }), "closed needs free a slot");
  const [r] = await approve(ids[1]);
  assert.equal(r.status, "open");
  assert.equal((await approve(ids[1])).length, 0, "already reviewed");
  const [sb] = await d.query(N.NEED_REVIEW_SQL, [ids[2], "send_back", "admin", "Please be more specific"]);
  assert.equal(sb.status, "changes_requested");
  await d.query(N.NEED_UPDATE_SQL, [ids[1], "owner", "skills", "A designer", null, null, "pending"]);
  assert.equal((await d.query("SELECT status FROM project_needs WHERE id::text = $1", [ids[1]]))[0].status, "pending");
  assert.equal((await d.query(N.NEED_UPDATE_SQL, [ids[1], "helper", "skills", "Hijack", null, null, "open"])).length, 0, "only the owner edits");
  await approve(ids[1]);
  assert.equal((await d.query(N.NEED_OWNER_STATUS_SQL, [ids[1], "owner", "met", "open"])).length, 1);
  assert.equal((await d.query(N.NEED_OWNER_STATUS_SQL, [ids[1], "helper", "closed", "met"])).length, 0);
  const mine = await d.query(N.MY_NEEDS_SQL, ["owner"]);
  assert.equal(mine.length, 6);
  assert.ok(!JSON.stringify(mine).includes("@"), "no emails");
  assert.equal((await d.query(N.PENDING_NEEDS_COUNT_SQL))[0].n, 3);
  await pg.close();
});

test("a need is never more visible than its idea: public lists, browse filter and help offers", async () => {
  const { pg, d, idea, need, approve } = await fixture();
  const pub = await idea({ name: "Public" });
  const mem = await idea({ name: "Members", audience: "members" });
  const hidden = await idea({ name: "Hidden", hidden: true });
  const pending = await idea({ name: "Pending", status: "pending" });
  const nPub = await need(pub), nMem = await need(mem), nHid = await need(hidden), nPen = await need(pending);
  const nPubPending = await need(pub, { title: "Not reviewed" });
  for (const n of [nPub, nMem, nHid, nPen]) await approve(n);
  const support = (await d.query(N.PUBLIC_OPEN_NEEDS_SQL, [10])).map((r) => r.id);
  assert.deepEqual(support, [nPub], "only open needs on public, approved, visible ideas");
  const browse = async (gated) => (await d.query(BROWSE_SQL, [gated, null, null, null, null, "", "%%", 24, 0, true])).map((r) => r.project_name).sort();
  assert.deepEqual(await browse(false), ["Public"]);
  assert.deepEqual(await browse(true), ["Members", "Public"]);
  // help offers only on open needs of approved, visible ideas
  assert.ok((await d.query(Q.HELP_INSERT_SQL, [nMem, "helper", "Happy to help with this idea.", null]))[0]);
  for (const n of [nHid, nPen, nPubPending]) assert.equal((await d.query(Q.HELP_INSERT_SQL, [n, "helper", "Happy to help with this idea.", null])).length, 0);
  // a need whose owner isn't the idea's owner (e.g. idea transferred) is never offered
  await d.query("UPDATE projects SET user_id = 'h2' WHERE id::text = $1", [pub]);
  assert.equal((await d.query(Q.HELP_INSERT_SQL, [nPub, "helper", "Happy to help with this idea.", null])).length, 0);
  assert.deepEqual((await d.query(N.PUBLIC_OPEN_NEEDS_SQL, [10])).length, 0);
  await pg.close();
});

test("help offer flow: notice parties, accept only by owner, intro recorded, decline, withdraw, expiry", async () => {
  const { pg, d, idea, need, approve, partner } = await fixture();
  const i = await idea();
  const n = await need(i);
  await approve(n);
  const p = await partner({ name: "IRSC" });
  await d.query(P.ADD_CONTACT_SQL, [p, "helper", "staff", "admin"]);
  const [{ id }] = await d.query(Q.HELP_INSERT_SQL, [n, "helper", "Our lab staff can mentor weekly.", p]);
  const [row] = await d.query(Q.ONE_SQL.help, [id]);
  assert.equal(row.extra, "IRSC", "offered on behalf of the partner");
  assert.deepEqual(row.responders, ["owner"]);
  assert.ok(!JSON.stringify(row).includes("@"), "list/detail never carry emails");
  const lists = await d.query(Q.LIST_SQL.help, ["owner"]);
  assert.equal(lists.length, 1);
  assert.ok(!JSON.stringify(lists).includes("@"));
  const [parties] = await d.query(Q.PARTIES_SQL.help, [id]);
  assert.deepEqual(parties.notify_emails, ["owner@example.com"]);
  await d.query(`UPDATE members SET email_prefs = '{"requests": false}' WHERE user_id = 'owner'`);
  assert.deepEqual((await d.query(Q.PARTIES_SQL.help, [id]))[0].notify_emails, [], "respects the requests preference");
  // a non-contact can't claim a partner
  const n2 = await need(i, { title: "Another need" });
  await approve(n2);
  const [{ id: id2 }] = await d.query(Q.HELP_INSERT_SQL, [n2, "h2", "I can help with this one.", p]);
  assert.equal((await d.query(Q.ONE_SQL.help, [id2]))[0].extra, null);
  assert.equal((await d.query(Q.RESPOND_SQL.help, [id, "helper", "accepted", false])).length, 0, "helper can't accept own offer");
  assert.equal((await d.query(Q.RESPOND_SQL.help, [id, "admin", "accepted", true])).length, 0, "admins don't answer help offers");
  assert.equal((await d.query(Q.RESPOND_SQL.help, [id, "owner", "accepted", false])).length, 1);
  await d.query(Q.INTRO_RESULT_SQL.help, [id, true, "em_1", null]);
  assert.ok((await d.query(Q.ONE_SQL.help, [id]))[0].intro_sent_at);
  assert.equal((await d.query(Q.WITHDRAW_SQL.help, [id, "helper"])).length, 0, "can't withdraw after accept");
  assert.equal((await d.query(Q.WITHDRAW_SQL.help, [id2, "owner"])).length, 0, "only the helper withdraws");
  assert.equal((await d.query(Q.WITHDRAW_SQL.help, [id2, "h2"])).length, 1);
  const [{ id: id3 }] = await d.query(Q.HELP_INSERT_SQL, [n2, "h2", "Trying once more to help.", null]);
  assert.equal((await d.query(Q.RESPOND_SQL.help, [id3, "owner", "declined", false])).length, 1);
  const [{ id: id4 }] = await d.query(Q.HELP_INSERT_SQL, [n2, "staff", "Old offer to help here.", null]);
  await d.query("UPDATE help_offers SET created_at = now() - interval '31 days' WHERE id::text = $1", [id4]);
  assert.equal((await d.query(Q.RESPOND_SQL.help, [id4, "owner", "accepted", false])).length, 0, "expired offers can't be accepted");
  for (const s of Q.EXPIRE_ALL_SQL) await d.query(s);
  assert.equal((await d.query(Q.ONE_SQL.help, [id4]))[0].status, "expired");
  assert.equal(Number((await d.query(Q.SENT_LAST_DAY_ALL_SQL, ["h2"]))[0].n), 2, "shared daily limit counts every kind");
  assert.equal((await d.query(Q.PARTNER_HELP_OFFERS_SQL, [p])).length, 1);
  await pg.close();
});

test("offer requests: only live request_via_pana offers; contacts or admin answer; PANA queue when no contacts", async () => {
  const { pg, d, idea, partner, offer } = await fixture();
  const p = await partner({ name: "Library" });
  const o = await offer(p);
  const badge = await offer(p, { claim: "external_link" }).catch(() => null);
  assert.equal(badge, null, "external link offers need a url (constraint)");
  const draft = await offer(p, { status: "draft" });
  const myIdea = await idea({ user: "helper", name: "Helper idea" });
  const otherIdea = await idea({ name: "Owner idea" });
  assert.equal((await d.query(Q.OFFER_REQUEST_INSERT_SQL, [draft, "helper", "I'd like lab time in March.", null])).length, 0, "not live");
  const [{ id }] = await d.query(Q.OFFER_REQUEST_INSERT_SQL, [o, "helper", "I'd like lab time in March.", myIdea]);
  const [{ id: id2 }] = await d.query(Q.OFFER_REQUEST_INSERT_SQL, [o, "h2", "Could I book two evenings?", otherIdea]);
  assert.equal((await d.query("SELECT project_id FROM offer_requests WHERE id::text = $1", [id2]))[0].project_id, null, "only your own idea can be attached");
  assert.equal((await d.query(Q.OFFER_REQUEST_INSERT_SQL, [o, "helper", "Asking again for lab time.", null])).length, 0, "one open request");
  // no contacts → PANA (admin) queue
  assert.deepEqual((await d.query(Q.ADMIN_OFFER_REQUESTS_SQL)).map((r) => r.id).sort(), [id, id2].sort());
  const [one] = await d.query(Q.ONE_SQL.offer, [id]);
  assert.equal(one.extra, "Helper idea");
  assert.deepEqual(one.responders, []);
  assert.equal((await d.query(Q.PARTIES_SQL.offer, [id]))[0].contact_count, 0);
  assert.equal(Number((await d.query(P.PORTAL_TODO_SQL))[0].n), 2);
  assert.equal((await d.query(Q.RESPOND_SQL.offer, [id, "staff", "accepted", false])).length, 0, "non-contact can't answer");
  // link a contact; they answer, and the request leaves the PANA queue
  await d.query(P.ADD_CONTACT_SQL, [p, "staff", "manager", "admin"]);
  assert.equal((await d.query(Q.ADMIN_OFFER_REQUESTS_SQL)).length, 0);
  assert.deepEqual((await d.query(Q.ONE_SQL.offer, [id]))[0].responders, ["staff"]);
  const [parties] = await d.query(Q.PARTIES_SQL.offer, [id]);
  assert.deepEqual(parties.notify_emails, ["staff@example.com"]);
  assert.equal(parties.responder_email, null, "no responder address until someone accepts");
  assert.equal((await d.query(Q.RESPOND_SQL.offer, [id, "helper", "accepted", true])).length, 0, "requester can't accept own request, even as admin");
  assert.equal((await d.query(Q.RESPOND_SQL.offer, [id, "staff", "accepted", false])).length, 1);
  const [after] = await d.query(Q.PARTIES_SQL.offer, [id]);
  assert.equal(after.responder_email, "staff@example.com");
  assert.equal(after.responded_by, "staff");
  // admin answers the other one → no contact responder; intro goes to the PANA inbox (app side)
  assert.equal((await d.query(Q.RESPOND_SQL.offer, [id2, "admin", "declined", true])).length, 1);
  assert.equal((await d.query(Q.PARTIES_SQL.offer, [id2]))[0].responder_email, null);
  assert.equal((await d.query(Q.LIST_SQL.offer, ["staff"])).length, 2, "contacts see their partner's requests");
  assert.ok(!JSON.stringify(await d.query(Q.PARTNER_OFFER_REQUESTS_SQL, [p])).includes("@"));
  // paused partner: no new requests
  await d.query("UPDATE partners SET status = 'paused' WHERE id::text = $1", [p]);
  assert.equal((await d.query(Q.OFFER_REQUEST_INSERT_SQL, [o, "h2", "Another request for lab time.", null])).length, 0);
  await pg.close();
});

test("partner contacts and portal: name-only search, proposed listing changes, offers back to review", async () => {
  const { pg, d, partner, offer } = await fixture();
  const p = await partner({ name: "St. Lucie Library" });
  await d.query("UPDATE members SET display_name = 'Sam Staff' WHERE user_id = 'staff'");
  assert.deepEqual((await d.query(P.MEMBER_SEARCH_SQL, ["%sam%", p])).map((r) => r.user_id), ["staff"]);
  assert.equal((await d.query(P.MEMBER_SEARCH_SQL, ["%staff@example%", p])).length, 0, "never searchable by email");
  assert.ok(!JSON.stringify(await d.query(P.MEMBER_SEARCH_SQL, ["%sam%", p])).includes("@"));
  await d.query("INSERT INTO members (user_id, email, display_name, status) VALUES ('newbie', 'n@example.com', 'Sam New', 'active')");
  assert.equal((await d.query(P.ADD_CONTACT_SQL, [p, "newbie", "staff", "admin"])).length, 0, "must have finished joining");
  assert.equal((await d.query(P.ADD_CONTACT_SQL, [p, "staff", "boss", "admin"])).length, 0, "valid roles only");
  const [{ id: cid }] = await d.query(P.ADD_CONTACT_SQL, [p, "staff", "staff", "admin"]);
  await d.query(P.ADD_CONTACT_SQL, [p, "staff", "manager", "admin"]);
  const contacts = await d.query(P.PARTNER_CONTACTS_SQL, [p]);
  assert.equal(contacts.length, 1);
  assert.equal(contacts[0].role, "manager", "re-adding updates the role");
  assert.ok(!JSON.stringify(contacts).includes("@"));
  assert.equal((await d.query(P.MEMBER_SEARCH_SQL, ["%sam%", p])).length, 0, "existing contacts aren't suggested");
  assert.equal((await d.query(P.IS_CONTACT_SQL, [p, "staff"]))[0].role, "manager");
  assert.equal((await d.query(P.IS_CONTACT_SQL, [p, "helper"])).length, 0);
  // listing changes wait for review
  const change = JSON.stringify({ name: "St. Lucie County Library", summary: "Computers and rooms.", website: "https://slc.example.org", area: "Port St. Lucie" });
  assert.equal((await d.query(P.PROPOSE_CHANGES_SQL, [p, "helper", change])).length, 0, "non-contacts can't propose");
  await d.query(P.PROPOSE_CHANGES_SQL, [p, "staff", change]);
  assert.equal((await d.query("SELECT name FROM partners WHERE id::text = $1", [p]))[0].name, "St. Lucie Library", "live listing unchanged until approved");
  assert.equal((await d.query(P.PARTNERS_WITH_CHANGES_SQL)).length, 1);
  await d.query(P.APPLY_CHANGES_SQL, [p]);
  const [live] = await d.query("SELECT name, summary, area, pending_changes FROM partners WHERE id::text = $1", [p]);
  assert.deepEqual(live, { name: "St. Lucie County Library", summary: "Computers and rooms.", area: "Port St. Lucie", pending_changes: null });
  await d.query(P.PROPOSE_CHANGES_SQL, [p, "staff", change]);
  await d.query(P.DISCARD_CHANGES_SQL, [p]);
  assert.equal((await d.query(P.PARTNERS_WITH_CHANGES_SQL)).length, 0);
  // offers edited by a contact go back to review
  const o = await offer(p, { claim: "show_badge" }).catch(async () => (await d.query(
    "INSERT INTO resource_offers (partner_id, type, title, eligibility, claim_method, status) VALUES ($1, 'lab_hours', 'Lab', 'incubator_participants', 'show_badge', 'published') RETURNING id::text AS id", [p]))[0].id);
  assert.equal((await d.query(P.OFFER_BACK_TO_REVIEW_SQL, [o, p]))[0].id, o);
  assert.equal((await d.query("SELECT status FROM resource_offers WHERE id::text = $1", [o]))[0].status, "pending");
  const other = await partner({ name: "Other" });
  assert.equal((await d.query(P.OFFER_BACK_TO_REVIEW_SQL, [o, other])).length, 0, "only the partner's own offers");
  assert.deepEqual((await d.query(P.CONTACT_EMAILS_SQL, [p])).map((r) => r.email), ["staff@example.com"]);
  assert.equal((await d.query(P.MY_PARTNERS_SQL, ["staff"]))[0].role, "manager");
  await d.query(P.REMOVE_CONTACT_SQL, [cid, p]);
  assert.equal((await d.query(P.MY_PARTNERS_SQL, ["staff"])).length, 0);
  // deleting a member removes their links and requests (cascade)
  await d.query(P.ADD_CONTACT_SQL, [p, "staff", "staff", "admin"]);
  await d.query("DELETE FROM members WHERE user_id = 'staff'");
  assert.equal((await d.query(P.PARTNER_CONTACTS_SQL, [p])).length, 0);
  await pg.close();
});

test("collaboration requests still work through the shared SQL", async () => {
  const { pg, d, idea } = await fixture();
  const i = await idea();
  const [{ id }] = await d.query("INSERT INTO collaboration_requests (project_id, requester_user_id, owner_user_id, message) VALUES ($1, 'helper', 'owner', 'I can build the MVP with you.') RETURNING id::text AS id", [i]);
  const [r] = await d.query(Q.ONE_SQL.collab, [id]);
  assert.deepEqual(r.responders, ["owner"]);
  assert.equal(r.subject_href, `/ideas/${i}`);
  assert.equal((await d.query(Q.HAS_OPEN_SQL.collab, [i, "helper"])).length, 1);
  assert.equal((await d.query(Q.RESPOND_SQL.collab, [id, "helper", "accepted", false])).length, 0);
  assert.equal((await d.query(Q.RESPOND_SQL.collab, [id, "owner", "accepted", false])).length, 1);
  const [p] = await d.query(Q.PARTIES_SQL.collab, [id]);
  assert.equal(p.requester_email, "helper@example.com");
  assert.equal(p.responder_email, "owner@example.com");
  await d.query(Q.INTRO_RESULT_SQL.collab, [id, false, null, "boom"]);
  assert.equal((await d.query(Q.ONE_SQL.collab, [id]))[0].intro_error, "boom");
  await pg.close();
});
