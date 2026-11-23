"use server";
// Admin → Community (P3-4): John's announcements/events, board moderation and the opt-in digest. Every action is audited.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { BOARD_LIMITS, digestState, parseFeedPost } from "@/lib/community";
import {
  adminPost, createFeedPost, deleteDraft, digestCandidates, lastDigest, moderate, sendDigestBatch, setFeedPinned, setFeedStatus,
  startDigest, updateFeedPost, type Decision,
} from "@/lib/community-repo";
import { parseUuid } from "@/lib/incubator";

const back = (path: string, q: Record<string, string>) => `${path}?${new URLSearchParams(q).toString()}`;
const refresh = (slug?: string) => {
  revalidatePath("/admin", "layout"); revalidatePath("/community"); revalidatePath("/techcon"); revalidatePath("/");
  if (slug) revalidatePath(`/events/${slug}`);
};

export async function createFeedAction(fd: FormData) {
  const admin = await requireAdmin();
  const { data, error } = parseFeedPost(fd);
  if (!data) redirect(back("/admin/community/new", { error: error ?? "Invalid post." }));
  let id: string | null = null;
  try { id = await createFeedPost(data, admin.id); } catch (e) { console.error("createFeedPost failed", e); redirect(back("/admin/community/new", { error: "Database error. Please try again." })); }
  if (!id) redirect(back("/admin/community/new", { error: "That web address (slug) is already used." }));
  await audit(admin.id, "create_community_post", "community_post", id, data.title);
  refresh(data.slug);
  redirect(back(`/admin/community/${id}`, { notice: "created" }));
}

export async function updateFeedAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  if (!id) redirect("/admin/community");
  const before = await adminPost(id);
  const { data, error } = parseFeedPost(fd);
  if (!data) redirect(back(`/admin/community/${id}`, { error: error ?? "Invalid post." }));
  let ok = false;
  try { ok = await updateFeedPost(id, data); } catch (e) { console.error("updateFeedPost failed", e); redirect(back(`/admin/community/${id}`, { error: "Database error. Please try again." })); }
  if (!ok) redirect(back(`/admin/community/${id}`, { error: "That web address (slug) is already used." }));
  await audit(admin.id, "update_community_post", "community_post", id, data.title);
  refresh(data.slug);
  if (before?.slug && before.slug !== data.slug) revalidatePath(`/events/${before.slug}`);
  redirect(back(`/admin/community/${id}`, { notice: "saved" }));
}

export async function feedStatusAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  const to = String(fd.get("to") ?? "");
  if (!id || !["draft", "published", "archived", "pin", "unpin", "delete"].includes(to)) redirect("/admin/community");
  const post = await adminPost(id);
  if (!post) redirect("/admin/community");
  let ok: boolean;
  if (to === "pin" || to === "unpin") ok = await setFeedPinned(id, to === "pin");
  else if (to === "delete") ok = await deleteDraft(id);
  else ok = await setFeedStatus(id, to as "draft" | "published" | "archived");
  if (ok) await audit(admin.id, `community_post_${to}`, "community_post", id, post.title);
  refresh(post.slug);
  if (to === "delete") redirect(back("/admin/community", ok ? { notice: "deleted" } : { error: "Only drafts can be deleted. Archive it instead." }));
  redirect(back(`/admin/community/${id}`, ok ? { notice: to } : { error: "That change isn't possible right now." }));
}

const DECISIONS: Decision[] = ["approve", "decline", "remove", "restore", "keep"];
export async function moderateAction(fd: FormData) {
  const admin = await requireAdmin();
  const type = fd.get("type") === "reply" ? "reply" : "post";
  const id = parseUuid(fd.get("id"));
  const decision = String(fd.get("decision") ?? "") as Decision;
  const note = String(fd.get("note") ?? "").replace(/\s+/g, " ").trim().slice(0, BOARD_LIMITS.note) || null;
  if (!id || !DECISIONS.includes(decision)) redirect(back("/admin/community", { error: "Invalid moderation request." }));
  const ok = await moderate(type, id, decision, admin.id, note);
  if (ok) await audit(admin.id, `board_${type}_${decision}`, type === "post" ? "member_post" : "member_reply", id, note ?? undefined);
  revalidatePath("/admin", "layout"); revalidatePath("/community/board", "layout"); revalidatePath("/admin/reports");
  redirect(back("/admin/community", ok ? { notice: `board-${decision}` } : { error: "That item changed. Refresh and try again." }));
}

export async function startDigestAction(fd: FormData) {
  const admin = await requireAdmin();
  const last = await lastDigest();
  const st = digestState(last as never);
  if (!st.canStart) redirect(back("/admin/community", { error: "A digest went out recently. The next one can start after the 14-day gap." }));
  const ids = fd.getAll("post").map((v) => parseUuid(v)).filter((v): v is string => !!v);
  const allowed = new Set((await digestCandidates(last ? String(last.created_at) : null)).map((p) => p.id));
  const chosen = ids.filter((i) => allowed.has(i));
  if (!chosen.length) redirect(back("/admin/community", { error: "Choose at least one announcement or event for the digest." }));
  const r = await startDigest(admin.id, chosen);
  if (!r) redirect(back("/admin/community", { error: "Couldn't start the digest." }));
  await audit(admin.id, "community_digest_start", "community_digest", r.id, `${chosen.length} items, ${r.sent} sent, ${r.failed} failed`);
  revalidatePath("/admin/community");
  redirect(back("/admin/community", { notice: "digest", sent: String(r.sent), failed: String(r.failed) }));
}

export async function continueDigestAction() {
  const admin = await requireAdmin();
  const last = await lastDigest();
  const st = digestState(last as never);
  if (!last || !st.canContinue) redirect(back("/admin/community", { error: "Nothing to continue yet (one batch a day)." }));
  const r = await sendDigestBatch(String(last.id), (last.post_ids as string[]) ?? []);
  await audit(admin.id, "community_digest_batch", "community_digest", String(last.id), `${r.sent} sent, ${r.failed} failed`);
  revalidatePath("/admin/community");
  redirect(back("/admin/community", { notice: "digest", sent: String(r.sent), failed: String(r.failed) }));
}
