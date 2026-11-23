// Community feed, events, member board and digest (P3-4): data access + emails. SQL in lib/community-sql.ts (PGlite-tested).
import sql, { raw, type Row } from "@/lib/db";
import { formatDateTime } from "@/lib/datetime";
import {
  adminBoardReviewEmail, adminNotifyAddress, boardDecisionEmail, communityDigestEmail, sendEmail, SITE_URL, type DigestItem,
} from "@/lib/email";
import { canModerate, DIGEST_BATCH, DIGEST_MAX_POSTS, POSTS_PER_DAY, REPLIES_PER_DAY, type FeedInput, type MemberPostInput } from "@/lib/community";
import { AUTO_HIDE_REPORTS } from "@/lib/profile-input";
import * as S from "@/lib/community-sql";

const q = (text: string, params: unknown[] = []) => raw().query(text, params) as Promise<Row[]>;

export type FeedPost = {
  id: string; slug: string; kind: "announcement" | "event"; program: string; audience: string; status: string; pinned: boolean;
  title: string; body: string; starts_at: string | null; ends_at: string | null; location_name: string | null; address: string | null;
  is_online: boolean; registration_url: string | null; registration_note: string | null; price_text: string | null;
  published_at: string | null; created_at: string; updated_at: string;
};
export type BoardPost = {
  id: string; user_id: string; kind: string; title: string; body: string; status: string; hidden_by_reports: boolean; review_note: string | null;
  last_activity_at: string; created_at: string; author_name: string; author_profile_visible: boolean; reply_count: number; total?: number;
};
export type BoardReply = { id: string; user_id: string; body: string; status: string; hidden_by_reports: boolean; created_at: string; author_name: string; author_profile_visible: boolean };

// ---------- Feed ----------
export const announcements = async (member: boolean) => (await q(S.ANNOUNCEMENTS_SQL, [member])) as unknown as FeedPost[];
export const upcomingEvents = async (member: boolean) => (await q(S.UPCOMING_EVENTS_SQL, [member])) as unknown as FeedPost[];
export const postBySlug = async (member: boolean, slug: string) => ((await q(S.POST_BY_SLUG_SQL, [member, slug]))[0] as unknown as FeedPost) ?? null;
export const techcon = async () => ((await q(S.TECHCON_SQL))[0] as unknown as FeedPost) ?? null;
export const agendaOf = async (id: string) => (await q(S.AGENDA_SQL, [id])) as { time_label: string; title: string }[];
export const speakersOf = async (id: string) => (await q(S.SPEAKERS_SQL, [id])) as { name: string; role: string }[];
export const adminPosts = async () => (await q(S.ADMIN_POSTS_SQL)) as unknown as FeedPost[];
export const adminPost = async (id: string) => ((await q(S.ADMIN_POST_ONE_SQL, [id]))[0] as unknown as FeedPost) ?? null;

const feedParams = (d: FeedInput) => [d.kind, d.title, d.slug, d.body, d.program, d.audience, d.pinned, d.starts_at?.toISOString() ?? null,
  d.ends_at?.toISOString() ?? null, d.location_name, d.address, d.is_online, d.registration_url, d.registration_note, d.price_text];

async function saveLists(id: string, d: FeedInput) {
  await q(S.AGENDA_REPLACE_SQL, [id, d.agenda.map((a) => a.time_label), d.agenda.map((a) => a.title)]);
  await q(S.SPEAKERS_REPLACE_SQL, [id, d.speakers.map((s) => s.name), d.speakers.map((s) => s.role)]);
}

/** Returns the new id, or null when the web address is taken. */
export async function createFeedPost(d: FeedInput, adminId: string): Promise<string | null> {
  const [r] = await q(S.FEED_INSERT_SQL, [...feedParams(d), adminId]);
  if (!r) return null;
  await saveLists(String(r.id), d);
  return String(r.id);
}
export async function updateFeedPost(id: string, d: FeedInput): Promise<boolean> {
  const [r] = await q(S.FEED_UPDATE_SQL, [id, ...feedParams(d)]);
  if (!r) return false;
  await saveLists(id, d);
  return true;
}
export const setFeedStatus = async (id: string, status: "draft" | "published" | "archived") => (await q(S.FEED_STATUS_SQL, [id, status])).length > 0;
export const setFeedPinned = async (id: string, pinned: boolean) => (await q(S.FEED_PIN_SQL, [id, pinned])).length > 0;
export const deleteDraft = async (id: string) => (await q(S.FEED_DELETE_SQL, [id])).length > 0;

// ---------- Member board ----------
export const board = async (kind: string | null, limit: number, offset: number) => (await q(S.BOARD_SQL, [kind, limit, offset])) as unknown as BoardPost[];
export const myPosts = async (userId: string) => (await q(S.MY_POSTS_SQL, [userId])) as unknown as BoardPost[];
export const boardPost = async (id: string, viewer: string, isAdmin: boolean) => ((await q(S.POST_ONE_SQL, [id, viewer, isAdmin]))[0] as unknown as BoardPost) ?? null;
export const repliesOf = async (id: string, viewer: string, isAdmin: boolean) => (await q(S.REPLIES_SQL, [id, viewer, isAdmin])) as unknown as BoardReply[];
export const isTrusted = async (userId: string) => !!(await q(S.TRUSTED_SQL, [userId]))[0]?.trusted;

async function notifyAdminReview() {
  try { await sendEmail(adminBoardReviewEmail({ to: adminNotifyAddress() })); } catch (e) { console.error("board admin notice failed", e); }
}

/** Returns { id, status } or null (inactive member or over the daily limit). Status is decided in SQL. */
export async function createBoardPost(userId: string, d: MemberPostInput): Promise<{ id: string; status: string } | null> {
  const [r] = await q(S.POST_INSERT_SQL, [userId, d.kind, d.title, d.body, POSTS_PER_DAY]);
  if (!r) return null;
  if (r.status === "pending") await notifyAdminReview();
  return { id: String(r.id), status: String(r.status) };
}
export async function createReply(postId: string, userId: string, body: string): Promise<{ id: string; status: string } | null> {
  const [r] = await q(S.REPLY_INSERT_SQL, [postId, userId, body, REPLIES_PER_DAY]);
  if (!r) return null;
  if (r.status === "pending") await notifyAdminReview();
  return { id: String(r.id), status: String(r.status) };
}
export const deleteOwnPost = async (id: string, userId: string) => (await q(S.DELETE_OWN_POST_SQL, [id, userId])).length > 0;
export const deleteOwnReply = async (id: string, userId: string) => ((await q(S.DELETE_OWN_REPLY_SQL, [id, userId]))[0]?.post_id as string) ?? null;

export const adminQueue = async () => await q(S.ADMIN_QUEUE_SQL);
export const adminQueueCount = async () => Number((await q(S.ADMIN_QUEUE_COUNT_SQL))[0]?.n ?? 0);

export type Decision = "approve" | "decline" | "remove" | "restore" | "keep";
const ALL = ["pending", "published", "declined", "removed"];

/** John's decision on a board post or reply. Re-checked in SQL; "keep" = leave it up and dismiss the reports. */
export async function moderate(type: "post" | "reply", id: string, decision: Decision, adminId: string, note: string | null): Promise<boolean> {
  const to = { approve: "published", decline: "declined", remove: "removed", restore: "published", keep: "published" }[decision];
  const allowed = decision === "keep" ? ["published"] : ALL.filter((s) => canModerate(s, decision as Exclude<Decision, "keep">));
  const [r] = await q(type === "post" ? S.MODERATE_POST_SQL : S.MODERATE_REPLY_SQL, [id, to, adminId, note, allowed]);
  if (!r) return false;
  const targetType = type === "post" ? "member_post" : "member_reply";
  await q(S.RESOLVE_REPORTS_SQL, [targetType, id, adminId, decision === "remove" || decision === "decline" ? "actioned" : "dismissed"]);
  if (type === "post" && (decision === "approve" || decision === "decline")) {
    try {
      const [m] = await sql`SELECT m.email, m.status, m.email_prefs, p.title FROM member_posts p JOIN members m ON m.user_id = p.user_id WHERE p.id = ${id}::uuid`;
      if (m?.email && m.status === "active" && m.email_prefs?.reviews !== false) {
        await sendEmail(boardDecisionEmail({ to: m.email, title: m.title, decision: to as "published" | "declined", note, url: `${SITE_URL}/community/board/${id}` }));
      }
    } catch (e) { console.error("board decision email failed", e); }
  }
  return true;
}

/** A member's report. Three distinct reporters hide the item until John reviews it. Returns false for a duplicate. */
export async function reportBoard(reporter: string, type: "post" | "reply", id: string, reason: string, details: string | null): Promise<boolean> {
  const t = type === "post" ? "member_post" : "member_reply";
  const ok = (await q(S.REPORT_INSERT_SQL, [reporter, t, id, reason, details])).length > 0;
  if (ok) await q(type === "post" ? S.AUTO_HIDE_POST_SQL : S.AUTO_HIDE_REPLY_SQL, [id, AUTO_HIDE_REPORTS]);
  return ok;
}

// ---------- Digest ----------
export const digestAudience = async () => Number((await q(S.DIGEST_AUDIENCE_SQL))[0]?.n ?? 0);
export const lastDigest = async () => (await q(S.LAST_DIGEST_SQL))[0] ?? null;
export const digestCandidates = async (since: string | null) => (await q(S.DIGEST_CANDIDATES_SQL, [since, DIGEST_MAX_POSTS])) as unknown as FeedPost[];

function digestItems(posts: FeedPost[]): DigestItem[] {
  return posts.map((p) => ({
    title: p.title,
    url: p.program === "techcon" && p.kind === "event" ? `${SITE_URL}/techcon` : `${SITE_URL}/events/${p.slug}`,
    when: p.kind === "event" && p.starts_at ? formatDateTime(p.starts_at) : undefined,
    summary: p.body ? p.body.replace(/\s+/g, " ").slice(0, 200) + (p.body.length > 200 ? "…" : "") : undefined,
  }));
}

/** Send one batch (≤ DIGEST_BATCH) of a digest to opted-in members who haven't had it. Returns how many were sent. */
export async function sendDigestBatch(digestId: string, postIds: string[]): Promise<{ sent: number; failed: number }> {
  const posts = (await q(S.DIGEST_POSTS_SQL, [postIds])) as unknown as FeedPost[];
  const items = digestItems(posts);
  const targets = await q(S.DIGEST_TARGETS_SQL, [digestId, DIGEST_BATCH]);
  const done: string[] = [];
  let failed = 0;
  for (const t of targets) {
    const r = await sendEmail(communityDigestEmail({ to: String(t.email), items }));
    // Logged test addresses count as handled, so a batch is never retried for them.
    if (r.ok || ("skipped" in r && r.skipped)) done.push(String(t.user_id)); else failed++;
  }
  if (done.length) await q(S.DIGEST_MARK_SQL, [digestId, done]);
  return { sent: done.length, failed };
}

export async function startDigest(adminId: string, postIds: string[]): Promise<{ id: string; sent: number; failed: number } | null> {
  if (!postIds.length) return null;
  const [d] = await q(S.DIGEST_CREATE_SQL, [adminId, postIds.slice(0, DIGEST_MAX_POSTS)]);
  if (!d) return null;
  const r = await sendDigestBatch(String(d.id), postIds.slice(0, DIGEST_MAX_POSTS));
  return { id: String(d.id), ...r };
}
