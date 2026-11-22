"use server";
// Partner portal actions (P3-2b). Every action re-checks that the member is a contact of the partner (in SQL too).
// Nothing a contact submits goes live without John's review.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/members";
import { audit } from "@/lib/audit";
import { parseUuid } from "@/lib/incubator";
import { parseListingChanges, parseOffer } from "@/lib/partners";
import { getOffer, offerAction } from "@/lib/partners-repo";
import { contactCreateOffer, contactRole, contactUpdateOffer, proposeChanges } from "@/lib/partner-portal-repo";
import { raw } from "@/lib/db";
import { OFFER_BACK_TO_REVIEW_SQL } from "@/lib/partner-portal-sql";

const to = (path: string, q: Record<string, string>) => `${path}?${new URLSearchParams(q).toString()}`;
const refresh = () => { revalidatePath("/partner", "layout"); revalidatePath("/admin", "layout"); revalidatePath("/partners", "layout"); revalidatePath("/incubator/resources"); };

async function contact(fd: FormData) {
  const { userId } = await requireMember("/partner");
  const partnerId = parseUuid(fd.get("partner_id"));
  if (!partnerId || !(await contactRole(partnerId, userId))) redirect(to("/partner", { error: "You're not a contact for that partner." }));
  return { userId, partnerId };
}

export async function proposeListingAction(fd: FormData) {
  const { userId, partnerId } = await contact(fd);
  const { data, error } = parseListingChanges(fd);
  if (!data) redirect(to("/partner", { p: partnerId, error: error ?? "Invalid listing." }));
  const ok = await proposeChanges(partnerId, userId, data);
  if (ok) await audit(userId, "partner_contact_propose_listing", "partner", partnerId);
  refresh();
  redirect(to("/partner", ok ? { p: partnerId, notice: "listing-proposed" } : { p: partnerId, error: "Couldn't save your changes." }));
}

export async function contactCreateOfferAction(fd: FormData) {
  const { userId, partnerId } = await contact(fd);
  const { data, error } = parseOffer(fd);
  if (!data) redirect(to("/partner/offers/new", { p: partnerId, error: error ?? "Invalid offer." }));
  let id: string | null = null;
  try { id = await contactCreateOffer(partnerId, userId, data); } catch (e) { console.error("contactCreateOffer failed", e); }
  if (!id) redirect(to("/partner/offers/new", { p: partnerId, error: "Couldn't save the offer. Check the fields and try again." }));
  await audit(userId, "partner_contact_offer_create", "offer", id, data.title);
  refresh();
  redirect(to("/partner", { p: partnerId, notice: "offer-submitted" }));
}

export async function contactUpdateOfferAction(fd: FormData) {
  const { userId, partnerId } = await contact(fd);
  const id = parseUuid(fd.get("id"));
  if (!id) redirect(to("/partner", { p: partnerId, error: "Invalid offer." }));
  const { data, error } = parseOffer(fd);
  if (!data) redirect(to(`/partner/offers/${id}`, { error: error ?? "Invalid offer." }));
  let ok = false;
  try { ok = await contactUpdateOffer(partnerId, id, userId, data); } catch (e) { console.error("contactUpdateOffer failed", e); }
  if (ok) await audit(userId, "partner_contact_offer_update", "offer", id);
  refresh();
  redirect(to("/partner", ok ? { p: partnerId, notice: "offer-resubmitted" } : { p: partnerId, error: "Couldn't save the offer." }));
}

async function offerStatus(fd: FormData, action: "pause" | "archive" | "submit" | "resume") {
  const { userId, partnerId } = await contact(fd);
  const id = parseUuid(fd.get("id"));
  const before = id ? await getOffer(id) : null;
  if (!id || !before || before.partner_id !== partnerId) redirect(to("/partner", { p: partnerId, error: "Invalid offer." }));
  // Resuming a paused offer sends it back to review; contacts never publish directly.
  const r = action === "resume"
    ? (await raw().query(OFFER_BACK_TO_REVIEW_SQL, [id, partnerId]) as unknown[])[0] ?? null
    : await offerAction(id, action, userId, null);
  if (r) await audit(userId, `partner_contact_offer_${action}`, "offer", id);
  refresh();
  redirect(to("/partner", r ? { p: partnerId, notice: `offer-${action}` } : { p: partnerId, error: "That change isn't possible from the offer's current status." }));
}
export async function contactPauseOfferAction(fd: FormData) { await offerStatus(fd, "pause"); }
export async function contactArchiveOfferAction(fd: FormData) { await offerStatus(fd, "archive"); }
export async function contactSubmitOfferAction(fd: FormData) { await offerStatus(fd, "submit"); }
export async function contactResumeOfferAction(fd: FormData) { await offerStatus(fd, "resume"); }
