// P3-2a data access (Neon) + the emails it triggers. SQL lives in lib/partners-sql.ts (tested on PGlite).
import QRCode from "qrcode";
import { raw, type Row } from "@/lib/db";
import { adminNewInquiryEmail, adminNotifyAddress, inquiryThanksEmail, sendEmail, SITE_URL } from "@/lib/email";
import { slugify } from "@/lib/incubator";
import type { InquiryInput, OfferInput, PartnerInput } from "@/lib/partners";
import { badgeSecret, deriveToken, hashToken, newNonce } from "@/lib/badge";
import * as S from "@/lib/partners-sql";

const q = (text: string, params: unknown[] = []) => raw().query(text, params) as Promise<Row[]>;

// ---------- Public ----------

export const publicPartners = () => q(S.PUBLIC_PARTNERS_SQL);
export const publicPartner = async (slug: string) => (await q(S.PUBLIC_PARTNER_SQL, [slug]))[0] ?? null;
export const partnerLiveOffers = (partnerId: string) => q(S.PARTNER_LIVE_OFFERS_SQL, [partnerId]);
export const allLiveOffers = () => q(S.ALL_LIVE_OFFERS_SQL);
export const participantCohorts = async (userId: string | null) =>
  userId ? (await q(S.PARTICIPANT_COHORTS_SQL, [userId])).map((r) => r.cohort_id as string) : [];

export async function submitInquiry(d: InquiryInput): Promise<string> {
  const [r] = await q(S.INSERT_INQUIRY_SQL, [d.org_name, d.contact_name, d.contact_email, d.kind, d.can_offer, d.message]);
  try {
    await sendEmail(inquiryThanksEmail({ to: d.contact_email, name: d.contact_name, orgName: d.org_name }));
    await sendEmail(adminNewInquiryEmail({ to: adminNotifyAddress() }));
  } catch (e) {
    console.error("inquiry emails failed", e);
  }
  return r.id as string;
}

// ---------- Admin ----------

/** Lazy sweeps instead of a cron: expire offers past their end date, purge old declined/spam inquiries. */
export async function sweep(): Promise<void> {
  try { await q(S.EXPIRE_OFFERS_SQL); await q(S.PURGE_INQUIRIES_SQL); } catch (e) { console.error("partner sweep failed", e); }
}

export const adminInquiries = (filter: string) => q(S.ADMIN_INQUIRIES_SQL, [filter]);
export const setInquiryStatus = async (id: string, status: string, adminId: string, note: string | null) =>
  (await q(S.INQUIRY_STATUS_SQL, [id, status, adminId, note])).length > 0;
export const adminPartners = (includeRemoved = false) => q(S.ADMIN_PARTNERS_SQL, [includeRemoved]);
export const pendingOffers = () => q(S.PENDING_OFFERS_SQL);
export const adminPartnerOffers = (partnerId: string) => q(S.ADMIN_PARTNER_OFFERS_SQL, [partnerId]);
export const partnerTodo = async () => Number((await q(S.PARTNER_TODO_SQL))[0]?.n ?? 0);

export async function getPartner(id: string): Promise<Row | null> {
  return (await q(`SELECT ${S.PARTNER_COLS}, p.admin_note FROM partners p WHERE p.id::text = $1`, [id]))[0] ?? null;
}
export async function getOffer(id: string): Promise<Row | null> {
  return (await q(`SELECT ${S.OFFER_COLS} FROM resource_offers o WHERE o.id::text = $1`, [id]))[0] ?? null;
}

async function freeSlug(base: string, exceptId: string | null = null): Promise<string> {
  const root = slugify(base) || "partner";
  for (let i = 0; i < 50; i++) {
    const s = i === 0 ? root : `${root.slice(0, 56)}-${i + 1}`;
    const r = await q("SELECT 1 FROM partners WHERE slug = $1 AND ($2::text IS NULL OR id::text <> $2) LIMIT 1", [s, exceptId]);
    if (!r.length) return s;
  }
  return `${root.slice(0, 50)}-${Date.now().toString(36)}`;
}

export async function convertInquiry(id: string, adminId: string, orgName: string): Promise<string | null> {
  const slug = await freeSlug(orgName);
  return ((await q(S.CONVERT_INQUIRY_SQL, [id, slug, adminId]))[0]?.partner_id as string) ?? null;
}

export async function createPartner(d: PartnerInput, adminId: string): Promise<string> {
  const slug = await freeSlug(d.slug);
  const [r] = await q(
    `INSERT INTO partners (slug, name, kind, summary, website, area, public_listing, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id::text AS id`,
    [slug, d.name, d.kind, d.summary, d.website, d.area, d.public_listing, adminId]);
  return r.id as string;
}

export async function updatePartner(id: string, d: PartnerInput, adminNote: string | null): Promise<boolean> {
  const slug = await freeSlug(d.slug, id);
  const r = await q(
    `UPDATE partners SET slug = $2, name = $3, kind = $4, summary = $5, website = $6, area = $7, public_listing = $8,
            admin_note = $9, updated_at = now() WHERE id::text = $1 RETURNING id`,
    [id, slug, d.name, d.kind, d.summary, d.website, d.area, d.public_listing, adminNote]);
  return r.length > 0;
}

export const setPartnerStatus = async (id: string, status: string, adminId: string) =>
  (await q(S.PARTNER_STATUS_SQL, [id, status, adminId])).length > 0;

const OFFER_FIELDS = ["type", "title", "description", "location_name", "address", "schedule_text", "starts_on", "ends_on",
  "capacity_text", "eligibility", "cohort_id", "claim_method", "external_url", "how_to"] as const;

/** John enters offers for partners; they start as pending (or published right away when he ticks "publish now"). */
export async function createOffer(partnerId: string, d: OfferInput, adminId: string, publishNow: boolean): Promise<string> {
  const vals = OFFER_FIELDS.map((k) => d[k]);
  const [r] = await q(
    `INSERT INTO resource_offers (partner_id, ${OFFER_FIELDS.join(", ")}, status, created_by, approved_by, approved_at)
     VALUES ($1, ${OFFER_FIELDS.map((_, i) => `$${i + 2}`).join(", ")}, $${OFFER_FIELDS.length + 2}, $${OFFER_FIELDS.length + 3},
             $${OFFER_FIELDS.length + 4}, CASE WHEN $${OFFER_FIELDS.length + 2} = 'published' THEN now() END)
     RETURNING id::text AS id`,
    [partnerId, ...vals, publishNow ? "published" : "pending", adminId, publishNow ? adminId : null]);
  return r.id as string;
}

export async function updateOffer(id: string, d: OfferInput): Promise<boolean> {
  const sets = OFFER_FIELDS.map((k, i) => `${k} = $${i + 2}`).join(", ");
  const r = await q(`UPDATE resource_offers SET ${sets}, updated_at = now() WHERE id::text = $1 AND status <> 'archived' RETURNING id`,
    [id, ...OFFER_FIELDS.map((k) => d[k])]);
  return r.length > 0;
}

export async function offerAction(id: string, action: string, adminId: string, note: string | null) {
  return (await q(S.OFFER_ACTION_SQL, [id, action, adminId, note]))[0] ?? null;
}

// ---------- Badges ----------

export const badgesEnabled = () => badgeSecret() !== null;

function freshCode(): { nonce: string; hash: string } | null {
  const secret = badgeSecret();
  if (!secret) return null;
  const nonce = newNonce();
  return { nonce, hash: hashToken(deriveToken(secret, nonce)) };
}

/** Issue a badge for an accepted, active participant. Returns true if one exists afterwards. */
export async function issueBadge(applicationId: string): Promise<boolean> {
  const code = freshCode();
  if (!code) return false;
  await q(S.ISSUE_BADGE_SQL, [applicationId, code.nonce, code.hash]);
  return (await q(S.BADGE_FOR_APPLICATION_SQL, [applicationId])).length > 0;
}

/** Keep the badge in step with participant status: completed/left revokes; back to active reinstates a system revocation. */
export async function syncBadgeWithParticipant(applicationId: string, participantStatus: string): Promise<void> {
  const [b] = await q(S.BADGE_FOR_APPLICATION_SQL, [applicationId]);
  if (participantStatus === "active") {
    if (!b) { await issueBadge(applicationId); return; }
    if (b.revoked_at && b.revoked_by === "system") {
      const code = freshCode();
      if (code) await q(S.REINSTATE_BADGE_SQL, [b.id, code.nonce, code.hash]);
    }
    return;
  }
  if (b && !b.revoked_at) {
    await q(S.REVOKE_BADGE_SQL, [b.id, participantStatus === "completed" ? "Program completed" : "Left the program", "system"]);
  }
}

export type MyBadge = Row & { token?: string; verifyUrl?: string; qrSvg?: string };

/** The member's current badge (issuing lazily if they are an active participant without one), with its QR code. */
export async function myBadge(userId: string): Promise<MyBadge | null> {
  const secret = badgeSecret();
  if (!secret) return null;
  for (const a of await q(S.UNBADGED_APPLICATIONS_SQL, [userId])) await issueBadge(a.id as string);
  const rows = await q(S.MY_BADGES_SQL, [userId]);
  const b = (rows.find((r) => !r.revoked_at && r.app_status === "accepted" && r.participant_status === "active") ?? rows[0]) as MyBadge | undefined;
  if (!b) return null;
  if (!b.revoked_at) {
    const token = deriveToken(secret, b.token_nonce as string);
    b.verifyUrl = `${SITE_URL}/verify/${token}`;
    b.qrSvg = await QRCode.toString(b.verifyUrl, { type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#000000", light: "#ffffff" } });
  }
  delete (b as Row).token_nonce;
  return b;
}

export async function rotateMyBadge(userId: string, badgeId: string): Promise<boolean> {
  const code = freshCode();
  if (!code) return false;
  return (await q(S.ROTATE_BADGE_SQL, [userId, badgeId, code.nonce, code.hash])).length > 0;
}

export async function verifyToken(token: string): Promise<Row | null> {
  return (await q(S.VERIFY_BADGE_SQL, [hashToken(token)]))[0] ?? null;
}

export const adminBadges = () => q(S.ADMIN_BADGES_SQL);
export const revokeBadge = async (id: string, reason: string, adminId: string) => (await q(S.REVOKE_BADGE_SQL, [id, reason, adminId])).length > 0;
export async function reinstateBadge(id: string): Promise<boolean> {
  const code = freshCode();
  if (!code) return false;
  return (await q(S.REINSTATE_BADGE_SQL, [id, code.nonce, code.hash])).length > 0;
}
