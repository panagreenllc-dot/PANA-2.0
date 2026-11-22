"use server";
// Needs on ideas + "Offer help" (P3-2b). Every check is repeated in SQL; these give friendly errors.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewerCtx } from "@/lib/members";
import { parseProjectId } from "@/lib/ids";
import { canOwnerSetStatus, parseNeed, type NeedInput } from "@/lib/needs";
import { canSend, parseRequestMessage, SEND_ERRORS } from "@/lib/requests";
import { isGatedMember, needIsOpenFor } from "@/lib/visibility";
import { getIdea } from "@/lib/ideas-repo";
import { createNeed, needWithIdea, setNeedStatusByOwner, updateNeed } from "@/lib/needs-repo";
import * as R from "@/lib/requests-repo";
import { contactRole } from "@/lib/partner-portal-repo";

export type NeedFormState = { ok?: boolean; error?: string; notice?: string; values?: NeedInput };
export type HelpState = { ok?: boolean; error?: string };

const uuid = (v: unknown) => { const s = String(v ?? ""); return /^[0-9a-f-]{36}$/i.test(s) ? s.toLowerCase() : null; };

async function gatedCtx(next: string) {
  const { ctx } = await getViewerCtx();
  if (!ctx.userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(next)}`);
  if (ctx.status === "needs_welcome") redirect(`/welcome?next=${encodeURIComponent(next)}`);
  if (ctx.status !== "ok") redirect("/");
  return ctx as typeof ctx & { userId: string };
}

function refresh(ideaId: string) {
  revalidatePath(`/ideas/${ideaId}`);
  revalidatePath("/ideas");
  revalidatePath("/me");
  revalidatePath("/support");
  revalidatePath("/admin", "layout");
}

export async function addNeedAction(rawIdeaId: string, _prev: NeedFormState, fd: FormData): Promise<NeedFormState> {
  const ideaId = parseProjectId(rawIdeaId);
  if (!ideaId) redirect("/ideas");
  const ctx = await gatedCtx(`/ideas/${ideaId}`);
  const { data, error } = parseNeed(fd);
  if (!data) return { error };
  const id = await createNeed(ideaId, ctx.userId, data);
  if (!id) return { error: "Couldn't add this need. Ideas can have up to 5 active needs, and only the idea's owner can add them.", values: data };
  refresh(ideaId);
  return { ok: true, notice: "Need added. The PANA team reviews it before members see it." };
}

export async function updateNeedAction(rawNeedId: string, _prev: NeedFormState, fd: FormData): Promise<NeedFormState> {
  const needId = uuid(rawNeedId);
  if (!needId) redirect("/ideas");
  const cur = await needWithIdea(needId);
  if (!cur) return { error: "Need not found." };
  const ctx = await gatedCtx(`/ideas/${cur.project_id}`);
  const { data, error } = parseNeed(fd);
  if (!data) return { error, values: undefined };
  const r = await updateNeed(needId, ctx.userId, data);
  if (!r) return { error: "You can only edit your own needs (closed needs can't be edited)." };
  refresh(String(cur.project_id));
  return { ok: true, values: data, notice: r.status === "pending" ? "Saved. Your need is back in review and hidden until the PANA team approves it." : "Saved." };
}

export async function needStatusAction(fd: FormData) {
  const needId = uuid(fd.get("id"));
  if (!needId) redirect("/ideas");
  const cur = await needWithIdea(needId);
  if (!cur) redirect("/ideas");
  const ctx = await gatedCtx(`/ideas/${cur.project_id}`);
  const to = String(fd.get("to") ?? "");
  if (cur.owner_user_id === ctx.userId && canOwnerSetStatus(cur.status, to)) await setNeedStatusByOwner(needId, ctx.userId, cur.status, to);
  refresh(String(cur.project_id));
  redirect(`/ideas/${cur.project_id}?notice=need-${to}#needs`);
}

export async function offerHelpAction(rawNeedId: string, _prev: HelpState, fd: FormData): Promise<HelpState> {
  const needId = uuid(rawNeedId);
  if (!needId) return { error: "Need not found." };
  const cur = await needWithIdea(needId);
  if (!cur) return { error: "Need not found." };
  const ctx = await gatedCtx(`/ideas/${cur.project_id}`);
  const parsed = parseRequestMessage(fd, "help");
  if (!parsed.ok) return { error: parsed.error };
  const idea = await getIdea(String(cur.project_id));
  if (!idea) return { error: "Idea not found." };
  let partnerId = uuid(fd.get("partner_id"));
  if (partnerId && !(await contactRole(partnerId, ctx.userId))) partnerId = null;
  await R.expireAll();
  const check = canSend({
    viewerGated: isGatedMember(ctx), viewerId: ctx.userId, responderIds: [String(cur.owner_user_id)],
    targetOpen: needIsOpenFor(ctx, idea, cur as never),
    sentLast24h: await R.sentLastDayAll(ctx.userId), hasOpenRequest: await R.hasOpen("help", needId, ctx.userId),
  });
  if (!check.ok) return { error: SEND_ERRORS[check.reason] };
  const id = await R.createHelpOffer(needId, ctx.userId, parsed.message, partnerId);
  if (!id) return { error: "This need isn't open for offers right now." };
  await R.notifyResponder("help", id);
  revalidatePath(`/ideas/${cur.project_id}`);
  revalidatePath("/me");
  return { ok: true };
}
