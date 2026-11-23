"use server";
// Community board (P3-4): members post and reply to support each other. Every rule is repeated in SQL
// (POST_INSERT_SQL / REPLY_INSERT_SQL decide pending vs published and enforce daily limits).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseMemberPost, parseReply, POSTS_PER_DAY, REPLIES_PER_DAY } from "@/lib/community";
import { createBoardPost, createReply, deleteOwnPost, deleteOwnReply, reportBoard } from "@/lib/community-repo";
import { parseUuid } from "@/lib/incubator";
import { phase3Ctx } from "@/lib/phase3-gate";
import { parseReport } from "@/lib/profile-input";

export type BoardState = { ok?: boolean; error?: string; pending?: boolean; id?: string; values?: Record<string, string>; n?: number };

export async function createPostAction(prev: BoardState, fd: FormData): Promise<BoardState> {
  const values = { kind: String(fd.get("kind") ?? ""), title: String(fd.get("title") ?? ""), body: String(fd.get("body") ?? "") };
  const fail = (error: string) => ({ error, values, n: (prev.n ?? 0) + 1 });
  const ctx = await phase3Ctx("/community/board");
  const p = parseMemberPost(fd);
  if (!p.data) return fail(p.error!);
  const r = await createBoardPost(ctx.userId, p.data);
  if (!r) return fail(`You can post up to ${POSTS_PER_DAY} times a day. Please try again tomorrow.`);
  revalidatePath("/community/board");
  revalidatePath("/admin", "layout");
  return { ok: true, pending: r.status === "pending", id: r.id, n: (prev.n ?? 0) + 1 };
}

export async function replyAction(postId: string, prev: BoardState, fd: FormData): Promise<BoardState> {
  const values = { body: String(fd.get("body") ?? "") };
  const fail = (error: string) => ({ error, values, n: (prev.n ?? 0) + 1 });
  const id = parseUuid(postId);
  if (!id) return fail("Post not found.");
  const ctx = await phase3Ctx(`/community/board/${id}`);
  const p = parseReply(fd);
  if (!p.data) return fail(p.error!);
  const r = await createReply(id, ctx.userId, p.data);
  if (!r) return fail(`This post isn't taking replies right now, or you've reached ${REPLIES_PER_DAY} replies today.`);
  revalidatePath(`/community/board/${id}`);
  revalidatePath("/community/board");
  return { ok: true, pending: r.status === "pending", n: (prev.n ?? 0) + 1 };
}

export async function deletePostAction(fd: FormData) {
  const id = parseUuid(fd.get("id"));
  const ctx = await phase3Ctx("/community/board");
  if (id) await deleteOwnPost(id, ctx.userId);
  revalidatePath("/community/board");
  redirect("/community/board?notice=deleted");
}

export async function deleteReplyAction(fd: FormData) {
  const id = parseUuid(fd.get("id"));
  const ctx = await phase3Ctx("/community/board");
  const postId = id ? await deleteOwnReply(id, ctx.userId) : null;
  if (!postId) redirect("/community/board");
  revalidatePath(`/community/board/${postId}`);
  redirect(`/community/board/${postId}?notice=reply-deleted`);
}

export async function reportBoardAction(fd: FormData) {
  const type = fd.get("type") === "reply" ? "reply" : "post";
  const id = parseUuid(fd.get("id"));
  const postId = parseUuid(fd.get("post_id"));
  if (!id || !postId) redirect("/community/board");
  const ctx = await phase3Ctx(`/community/board/${postId}`);
  const p = parseReport(fd);
  if (!p.ok) redirect(`/community/board/${postId}?report=invalid`);
  const ok = await reportBoard(ctx.userId, type, id, p.reason, p.details || null);
  revalidatePath("/admin", "layout");
  revalidatePath(`/community/board/${postId}`);
  redirect(`/community/board/${postId}?report=${ok ? "reported" : "duplicate"}`);
}
