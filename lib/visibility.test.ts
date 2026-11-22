// Run: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { canViewIdea, canViewProfile, isGatedMember, toIdeaView, toProfileView, type IdeaRow, type ProfileRow, type ViewerCtx } from "./visibility";

const anon: ViewerCtx = { userId: null, status: "anon", isAdmin: false };
const pending: ViewerCtx = { userId: "user_new", status: "needs_welcome", isAdmin: false };
const banned: ViewerCtx = { userId: "user_bad", status: "banned", isAdmin: false };
const member: ViewerCtx = { userId: "user_m", status: "ok", isAdmin: false };
const owner: ViewerCtx = { userId: "user_o", status: "ok", isAdmin: false };
const ownerUngated: ViewerCtx = { userId: "user_o", status: "needs_welcome", isAdmin: false };
const admin: ViewerCtx = { userId: "user_a", status: "needs_welcome", isAdmin: true };

const profile = (o: Partial<ProfileRow> = {}): ProfileRow => ({
  user_id: "user_o", display_name: "Owner", headline: "Builder", experience: "x", roles: ["developer"],
  skills: ["ts"], interests: [], looking_for: ["collaborators"],
  links: { github: "https://github.com/o", bad: "mailto:o@x.com", js: "javascript:alert(1)" },
  is_published: true, moderation: "ok", member_status: "active", ...o,
});

test("gated membership", () => {
  assert.equal(isGatedMember(anon), false);
  assert.equal(isGatedMember(pending), false);
  assert.equal(isGatedMember(banned), false);
  assert.equal(isGatedMember(member), true);
  assert.equal(isGatedMember(admin), true);
});

test("profile visibility matrix", () => {
  const cases: [string, Partial<ProfileRow>, ViewerCtx, boolean][] = [
    ["published → anon", {}, anon, false],
    ["published → not-yet-gated user", {}, pending, false],
    ["published → banned user", {}, banned, false],
    ["published → member", {}, member, true],
    ["unpublished → member", { is_published: false }, member, false],
    ["hidden → member", { moderation: "hidden" }, member, false],
    ["owner banned → member", { member_status: "banned" }, member, false],
    ["owner deleted → member", { member_status: "deleted" }, member, false],
    ["unpublished → owner", { is_published: false }, owner, true],
    ["hidden → owner", { moderation: "hidden" }, owner, true],
    ["owner who hasn't done the gate", {}, ownerUngated, false],
    ["unpublished+hidden → admin", { is_published: false, moderation: "hidden" }, admin, true],
  ];
  for (const [name, o, v, expected] of cases) assert.equal(canViewProfile(v, profile(o)), expected, name);
});

test("profile view never leaks state or unsafe links to other members", () => {
  const view = toProfileView(member, profile())!;
  assert.equal(view.state, undefined);
  assert.deepEqual(view.links, { github: "https://github.com/o" });
  assert.equal("email" in view, false);
  assert.equal("member_status" in view, false);
  assert.deepEqual(toProfileView(owner, profile({ is_published: false }))!.state, { is_published: false, moderation: "ok" });
  assert.equal(toProfileView(anon, profile()), null);
});

const idea = (o: Partial<IdeaRow> = {}): IdeaRow => ({
  id: "1", user_id: "user_o", project_name: "Idea", category: "AI", description: "d", website: "https://x.com",
  details: "secret plan", help_needed: ["designer"], kind: "idea", stage: "concept", status: "approved",
  audience: "public", field_visibility: { details: "members", website: "public", help_needed: "public" },
  hidden_by_reports: false, ...o,
});

test("idea card visibility", () => {
  assert.equal(canViewIdea(anon, idea()), true);
  assert.equal(canViewIdea(anon, idea({ audience: "members" })), false);
  assert.equal(canViewIdea(pending, idea({ audience: "members" })), false);
  assert.equal(canViewIdea(member, idea({ audience: "members" })), true);
  for (const status of ["pending", "rejected", "withdrawn", "changes_requested"]) {
    assert.equal(canViewIdea(member, idea({ status })), false, status);
    assert.equal(canViewIdea(owner, idea({ status })), true, `owner sees own ${status}`);
  }
  assert.equal(canViewIdea(member, idea({ hidden_by_reports: true })), false);
  assert.equal(canViewIdea(admin, idea({ status: "pending", hidden_by_reports: true })), true);
});

test("idea per-field visibility", () => {
  const priv = idea({ field_visibility: { details: "private", website: "members", help_needed: "private" } });
  assert.deepEqual(Object.keys(toIdeaView(anon, idea())!).sort(), ["category", "description", "help_needed", "id", "kind", "project_name", "stage", "website"]);
  assert.equal(toIdeaView(anon, idea())!.details, undefined, "members-only details hidden from public");
  assert.equal(toIdeaView(member, idea())!.details, "secret plan");
  const m = toIdeaView(member, priv)!;
  assert.equal(m.details, undefined);
  assert.equal(m.help_needed, undefined);
  assert.equal(m.website, "https://x.com");
  assert.equal(toIdeaView(anon, priv)!.website, undefined);
  assert.equal(toIdeaView(owner, priv)!.details, "secret plan");
  assert.equal(toIdeaView(admin, priv)!.details, "secret plan");
  // Missing settings fall back to safe defaults (details = members).
  assert.equal(toIdeaView(anon, idea({ field_visibility: null }))!.details, undefined);
  assert.equal("email" in toIdeaView(admin, idea())!, false);
});

test("needs are never more visible than their idea", async () => {
  const { toNeedView, needIsOpenFor } = await import("./visibility");
  const idea = { user_id: "user_o", status: "approved", audience: "public", hidden_by_reports: false } as const;
  const need = { id: "n1", project_id: "p1", owner_user_id: "user_o", kind: "skills", title: "Designer", details: null, amount_text: null, status: "open", moderation_note: "internal" };
  assert.ok(toNeedView(anon, idea, need));
  assert.equal(toNeedView(anon, idea, need)?.moderation_note, undefined, "moderation notes only for owner/admin");
  assert.equal(toNeedView(owner, idea, need)?.moderation_note, "internal");
  assert.equal(toNeedView(anon, { ...idea, audience: "members" }, need), null);
  assert.ok(toNeedView(member, { ...idea, audience: "members" }, need));
  for (const i of [{ ...idea, status: "pending" }, { ...idea, hidden_by_reports: true }]) {
    assert.equal(toNeedView(member, i, need), null);
    assert.ok(toNeedView(owner, i, need), "owner still sees it");
    assert.ok(toNeedView(admin, i, need), "admin still sees it");
  }
  for (const status of ["pending", "changes_requested", "closed"]) assert.equal(toNeedView(member, idea, { ...need, status }), null);
  assert.ok(toNeedView(member, idea, { ...need, status: "met" }));
  assert.equal(toNeedView(owner, idea, { ...need, owner_user_id: "someone_else" }), null, "a need belongs to the idea's owner");
  assert.ok(needIsOpenFor(member, idea, need));
  assert.ok(!needIsOpenFor(owner, idea, need), "not your own");
  assert.ok(!needIsOpenFor(anon, idea, need));
  assert.ok(!needIsOpenFor(member, idea, { ...need, status: "met" }));
  const adminGated = { ...admin, status: "ok" as const };
  assert.ok(!needIsOpenFor(adminGated, { ...idea, hidden_by_reports: true }, need), "admins can't offer on hidden ideas");
});

test("needs are never more visible than their idea", async () => {
  const { toNeedView, needIsOpenFor } = await import("./visibility");
  const idea = { user_id: "user_o", status: "approved", audience: "public", hidden_by_reports: false } as const;
  const need = { id: "n1", project_id: "p1", owner_user_id: "user_o", kind: "skills", title: "Designer", details: null, amount_text: null, status: "open", moderation_note: "internal" };
  assert.ok(toNeedView(anon, idea, need));
  assert.equal(toNeedView(anon, idea, need)?.moderation_note, undefined, "moderation notes only for owner/admin");
  assert.equal(toNeedView(owner, idea, need)?.moderation_note, "internal");
  assert.equal(toNeedView(anon, { ...idea, audience: "members" }, need), null);
  assert.ok(toNeedView(member, { ...idea, audience: "members" }, need));
  for (const i of [{ ...idea, status: "pending" }, { ...idea, hidden_by_reports: true }]) {
    assert.equal(toNeedView(member, i, need), null);
    assert.ok(toNeedView(owner, i, need), "owner still sees it");
    assert.ok(toNeedView(admin, i, need), "admin still sees it");
  }
  for (const status of ["pending", "changes_requested", "closed"]) assert.equal(toNeedView(member, idea, { ...need, status }), null);
  assert.ok(toNeedView(member, idea, { ...need, status: "met" }));
  assert.equal(toNeedView(owner, idea, { ...need, owner_user_id: "someone_else" }), null, "a need belongs to the idea's owner");
  assert.ok(needIsOpenFor(member, idea, need));
  assert.ok(!needIsOpenFor(owner, idea, need), "not your own");
  assert.ok(!needIsOpenFor(anon, idea, need));
  assert.ok(!needIsOpenFor(member, idea, { ...need, status: "met" }));
  const adminGated = { ...admin, status: "ok" as const };
  assert.ok(!needIsOpenFor(adminGated, { ...idea, hidden_by_reports: true }, need), "admins can't offer on hidden ideas");
});
