"use server";
// Investor interest on ideas (P3-3): the owner's switch and the approved investor's "I'm interested".
// Every rule is repeated in SQL (INVESTOR_INSERT_SQL / SET_INVESTOR_OPEN_SQL).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseProjectId } from "@/lib/ids";
import { phase3Ctx } from "@/lib/phase3-gate";
import { canSend, parseRequestMessage, SEND_ERRORS } from "@/lib/requests";
import { INVESTOR_INTEREST_PER_DAY } from "@/lib/mentors";
import { canViewIdea, isGatedMember } from "@/lib/visibility";
import { getIdea } from "@/lib/ideas-repo";
import { isApprovedInvestor, setInvestorOpen } from "@/lib/mentors-repo";
import * as R from "@/lib/requests-repo";

export type InterestState = { ok?: boolean; error?: string };

export async function setInvestorOpenAction(fd: FormData) {
  const id = parseProjectId(fd.get("id"));
  if (!id) redirect("/ideas");
  const ctx = await phase3Ctx(`/ideas/${id}`);
  const open = fd.get("open") === "true";
  const ok = await setInvestorOpen(id, ctx.userId, open);
  revalidatePath(`/ideas/${id}`);
  revalidatePath("/ideas");
  redirect(`/ideas/${id}?notice=${ok ? (open ? "investors-on" : "investors-off") : "investors-denied"}#investors`);
}

export async function investorInterestAction(rawIdeaId: string, _prev: InterestState, fd: FormData): Promise<InterestState> {
  const id = parseProjectId(rawIdeaId);
  if (!id) return { error: "Idea not found." };
  const ctx = await phase3Ctx(`/ideas/${id}`);
  const parsed = parseRequestMessage(fd, "investor");
  if (!parsed.ok) return { error: parsed.error };
  const idea = await getIdea(id);
  if (!idea) return { error: "Idea not found." };
  if (!(await isApprovedInvestor(ctx.userId))) return { error: "Only PANA-approved investors can send investor interest. Apply from your profile." };
  await R.expireAll();
  // Judge visibility as an ordinary member, so admins can't reach hidden or private ideas this way.
  const asMember = { ...ctx, isAdmin: false };
  const check = canSend({
    viewerGated: isGatedMember(ctx), viewerId: ctx.userId, responderIds: [idea.user_id],
    targetOpen: idea.status === "approved" && !idea.hidden_by_reports && !!idea.investor_interest_open && canViewIdea(asMember, idea),
    sentLast24h: await R.sentLastDayAll(ctx.userId), hasOpenRequest: await R.hasOpen("investor", id, ctx.userId),
    kindSentLast24h: await R.sentLastDayKind("investor", ctx.userId), kindLimit: INVESTOR_INTEREST_PER_DAY,
  });
  if (!check.ok) return { error: check.reason === "not_visible" ? "This idea isn't open to investor interest right now." : SEND_ERRORS[check.reason] };
  const rid = await R.createInvestorInterest(id, ctx.userId, parsed.message);
  if (!rid) return { error: "This idea isn't open to investor interest right now." };
  await R.notifyResponder("investor", rid);
  revalidatePath(`/ideas/${id}`);
  revalidatePath("/me");
  return { ok: true };
}
