"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewer, getViewerCtx } from "@/lib/members";
import { parseProjectId } from "@/lib/ids";
import { parseIdea, type IdeaFormState } from "@/lib/ideas";
import { parseReport } from "@/lib/profile-input";
import { canRequest, parseRequestMessage } from "@/lib/collab";
import { canViewIdea, isGatedMember } from "@/lib/visibility";
import {
  createRequest, expireStale, getIdea, hasOpenRequest, notifyOwnerOfRequest, reportIdea, sentLastDay,
  setOwnerStatus, updateIdeaByOwner,
} from "@/lib/ideas-repo";

function uuidOr404(raw: unknown): string {
  const id = parseProjectId(raw);
  if (!id) redirect("/ideas");
  return id;
}

async function gatedUser(next: string): Promise<string> {
  const v = await getViewer();
  if (v.status === "anon" || !v.userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(next)}`);
  if (v.status === "needs_welcome") redirect(`/welcome?next=${encodeURIComponent(next)}`);
  if (v.status !== "ok") redirect("/");
  return v.userId;
}

function refresh(id: string) {
  revalidatePath("/ideas");
  revalidatePath(`/ideas/${id}`);
  revalidatePath("/me");
  revalidatePath("/admin", "layout");
}

export async function updateIdeaAction(rawId: string, _prev: IdeaFormState, fd: FormData): Promise<IdeaFormState> {
  const id = uuidOr404(rawId);
  const userId = await gatedUser(`/ideas/${id}/edit`);
  const { data, state } = parseIdea(fd);
  if (!data) return state!;
  const r = await updateIdeaByOwner(id, userId, data);
  if (!r) return { error: "Idea not found, or you're not its owner." };
  refresh(id);
  return {
    ok: true, values: data,
    notice: r.reReview
      ? "Saved. Because you changed public text, your idea is back in review and hidden until an admin approves it."
      : "Saved.",
  };
}

export async function withdrawIdeaAction(fd: FormData) {
  const id = uuidOr404(fd.get("id"));
  const userId = await gatedUser(`/ideas/${id}`);
  await setOwnerStatus(id, userId, "withdrawn");
  refresh(id);
  redirect(`/ideas/${id}?notice=withdrawn`);
}

export async function resubmitIdeaAction(fd: FormData) {
  const id = uuidOr404(fd.get("id"));
  const userId = await gatedUser(`/ideas/${id}`);
  await setOwnerStatus(id, userId, "pending");
  refresh(id);
  redirect(`/ideas/${id}?notice=resubmitted`);
}

export async function reportIdeaAction(fd: FormData) {
  const id = uuidOr404(fd.get("id"));
  const userId = await gatedUser(`/ideas/${id}`);
  const idea = await getIdea(id);
  if (!idea) redirect("/ideas");
  if (idea.user_id === userId) redirect(`/ideas/${id}?notice=report-self`);
  const parsed = parseReport(fd);
  if (!parsed.ok) redirect(`/ideas/${id}?notice=report-invalid`);
  const r = await reportIdea(userId, id, parsed.reason, parsed.details);
  refresh(id);
  redirect(r === "auto_hidden" ? "/ideas?reported=1" : `/ideas/${id}?notice=report-${r}`);
}

export type CollabState = { ok?: boolean; error?: string };

export async function requestCollabAction(rawId: string, _prev: CollabState, fd: FormData): Promise<CollabState> {
  const id = uuidOr404(rawId);
  await gatedUser(`/ideas/${id}`);
  const { ctx } = await getViewerCtx();
  const parsed = parseRequestMessage(fd);
  if (!parsed.ok) return { error: parsed.error };
  const idea = await getIdea(id);
  if (!idea) return { error: "Idea not found." };
  await expireStale();
  const check = canRequest({
    viewerGated: isGatedMember(ctx), viewerId: ctx.userId, ownerId: idea.user_id,
    ideaVisible: idea.status === "approved" && canViewIdea({ ...ctx, isAdmin: false }, idea),
    sentLast24h: await sentLastDay(ctx.userId!), hasOpenRequest: await hasOpenRequest(id, ctx.userId!),
  });
  if (!check.ok) {
    const msg = {
      not_member: "Please finish joining PANA first.",
      own_idea: "This is your own idea.",
      not_visible: "This idea isn't open for requests right now.",
      already_open: "You already have an open request for this idea.",
      rate_limited: "You've sent the maximum number of requests for today. Please try again tomorrow.",
    }[check.reason];
    return { error: msg };
  }
  const reqId = await createRequest(id, ctx.userId!, idea.user_id!, parsed.message);
  if (!reqId) return { error: "You already have an open request for this idea." };
  await notifyOwnerOfRequest(reqId).catch((e) => console.error("notifyOwnerOfRequest failed", e));
  revalidatePath(`/ideas/${id}`);
  revalidatePath("/me");
  return { ok: true };
}
