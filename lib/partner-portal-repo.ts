// Partner contacts + the /partner portal (P3-2b). SQL in lib/partner-portal-sql.ts (tested on PGlite).
// Contacts can propose listing text and offers; nothing they submit goes live until John approves it.
import { raw, type Row } from "@/lib/db";
import { adminNotifyAddress, adminPartnerUpdateEmail, partnerNoticeEmail, sendEmail } from "@/lib/email";
import { likePattern } from "@/lib/profile-sql";
import type { OfferInput } from "@/lib/partners";
import { createOffer, updateOffer } from "@/lib/partners-repo";
import * as S from "@/lib/partner-portal-sql";

const q = (text: string, params: unknown[] = []) => raw().query(text, params) as Promise<Row[]>;

export const partnerContacts = (partnerId: string) => q(S.PARTNER_CONTACTS_SQL, [partnerId]);
export const addContact = async (partnerId: string, userId: string, role: string, adminId: string) =>
  (await q(S.ADD_CONTACT_SQL, [partnerId, userId, role, adminId])).length > 0;
export const removeContact = async (contactId: string, partnerId: string) => (await q(S.REMOVE_CONTACT_SQL, [contactId, partnerId])).length > 0;
export async function searchMembersByName(text: string, partnerId: string): Promise<Row[]> {
  const t = text.trim().slice(0, 60);
  return t.length < 2 ? [] : q(S.MEMBER_SEARCH_SQL, [likePattern(t), partnerId]);
}
export const myPartners = (userId: string) => q(S.MY_PARTNERS_SQL, [userId]);
export const contactRole = async (partnerId: string, userId: string) => ((await q(S.IS_CONTACT_SQL, [partnerId, userId]))[0]?.role as string) ?? null;
export const partnersWithChanges = () => q(S.PARTNERS_WITH_CHANGES_SQL);
export const portalTodo = async () => Number((await q(S.PORTAL_TODO_SQL))[0]?.n ?? 0);

export type ListingChanges = { name: string; summary: string | null; website: string | null; area: string | null };

export async function proposeChanges(partnerId: string, userId: string, c: ListingChanges): Promise<boolean> {
  const ok = (await q(S.PROPOSE_CHANGES_SQL, [partnerId, userId, JSON.stringify(c)])).length > 0;
  if (ok) await sendEmail(adminPartnerUpdateEmail({ to: adminNotifyAddress(), what: "listing" })).catch(() => {});
  return ok;
}
export const applyChanges = async (partnerId: string) => (await q(S.APPLY_CHANGES_SQL, [partnerId])).length > 0;
export const discardChanges = async (partnerId: string) => (await q(S.DISCARD_CHANGES_SQL, [partnerId])).length > 0;

/** Contact submits a new offer: always pending (John reviews). */
export async function contactCreateOffer(partnerId: string, userId: string, d: OfferInput): Promise<string | null> {
  if (!(await contactRole(partnerId, userId))) return null;
  const id = await createOffer(partnerId, d, userId, false);
  await sendEmail(adminPartnerUpdateEmail({ to: adminNotifyAddress(), what: "offer" })).catch(() => {});
  return id;
}

/** Contact edits an offer: saved, then back to John's review queue. */
export async function contactUpdateOffer(partnerId: string, offerId: string, userId: string, d: OfferInput): Promise<boolean> {
  if (!(await contactRole(partnerId, userId))) return false;
  const own = await q("SELECT 1 FROM resource_offers WHERE id::text = $1 AND partner_id::text = $2", [offerId, partnerId]);
  if (!own.length || !(await updateOffer(offerId, d))) return false;
  const ok = (await q(S.OFFER_BACK_TO_REVIEW_SQL, [offerId, partnerId])).length > 0;
  if (ok) await sendEmail(adminPartnerUpdateEmail({ to: adminNotifyAddress(), what: "offer" })).catch(() => {});
  return ok;
}

/** Status notice to a partner's contacts (offer live / needs changes / listing approved). Best effort. */
export async function notifyContacts(partnerId: string, partnerName: string, subject: string, line: string, note?: string | null): Promise<void> {
  try {
    const to = (await q(S.CONTACT_EMAILS_SQL, [partnerId])).map((r) => r.email as string).filter(Boolean);
    for (const addr of to) await sendEmail(partnerNoticeEmail({ to: [addr], partnerName, subject, line, note }));
  } catch (e) {
    console.error("partner notice failed", e);
  }
}

export const offerForRequest = async (offerId: string) => (await q(S.OFFER_FOR_REQUEST_SQL, [offerId]))[0] ?? null;
