"use server";
// "Request through PANA" for partner offers (P3-2b). Checks repeated in SQL (OFFER_REQUEST_INSERT_SQL).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getViewerCtx } from "@/lib/members";
import { canUseOffer } from "@/lib/partners";
import { canSend, parseRequestMessage, SEND_ERRORS } from "@/lib/requests";
import { isGatedMember } from "@/lib/visibility";
import { participantCohorts } from "@/lib/partners-repo";
import { offerForRequest } from "@/lib/partner-portal-repo";
import * as R from "@/lib/requests-repo";

export type OfferRequestState = { ok?: boolean; error?: string; id?: string };

export async function requestOfferAction(rawOfferId: string, _prev: OfferRequestState, fd: FormData): Promise<OfferRequestState> {
  const offerId = /^[0-9a-f-]{36}$/i.test(rawOfferId) ? rawOfferId.toLowerCase() : null;
  if (!offerId) return { error: "Offer not found." };
  const next = `/offers/${offerId}/request`;
  const { ctx } = await getViewerCtx();
  if (!ctx.userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(next)}`);
  if (ctx.status === "needs_welcome") redirect(`/welcome?next=${encodeURIComponent(next)}`);
  const parsed = parseRequestMessage(fd, "offer");
  if (!parsed.ok) return { error: parsed.error };
  const o = await offerForRequest(offerId);
  if (!o) return { error: "Offer not found." };
  const projectRaw = String(fd.get("project_id") ?? "");
  const projectId = /^[0-9a-f-]{36}$/i.test(projectRaw) ? projectRaw.toLowerCase() : null;
  await R.expireAll();
  const cohorts = await participantCohorts(ctx.userId);
  const check = canSend({
    viewerGated: isGatedMember(ctx), viewerId: ctx.userId, responderIds: o.contact_ids as string[], targetOpen: !!o.open,
    eligible: canUseOffer(o as never, { member: isGatedMember(ctx), participantCohorts: cohorts }),
    sentLast24h: await R.sentLastDayAll(ctx.userId), hasOpenRequest: await R.hasOpen("offer", offerId, ctx.userId),
  });
  if (!check.ok) return { error: check.reason === "own" ? "You're a contact for this partner, so you can't request its offer." : SEND_ERRORS[check.reason] };
  const id = await R.createOfferRequest(offerId, ctx.userId, parsed.message, projectId);
  if (!id) return { error: "This offer isn't open for requests right now." };
  await R.notifyResponder("offer", id);
  revalidatePath("/me");
  return { ok: true, id };
}
