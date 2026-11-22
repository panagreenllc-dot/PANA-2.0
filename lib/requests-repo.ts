// Shared request + introduction flow (P3-2b) for every kind: collaboration requests on ideas, help offers on needs,
// "Request through PANA" offer requests, and (P3-3) mentorship requests and investor interest.
// Rule: no email address is shown or sent to anyone until the responder accepts; then ONE introduction email goes
// to both sides. SQL lives in lib/requests-sql.ts (tested on PGlite).
import { raw, type Row } from "@/lib/db";
import {
  adminNotifyAddress, declinedEmail, introductionEmail, newRequestEmail, offerRequestNoticeEmail, helpOfferNoticeEmail,
  investorInterestNoticeEmail, mentorshipNoticeEmail, NOT_VETTED, requestDeclinedEmail, requestIntroEmail, sendEmail, SITE_URL, type EmailMessage,
} from "@/lib/email";
import { INVESTOR_TYPES, label } from "@/lib/mentors";
import { KIND_INFO, type RequestKind } from "@/lib/requests";
import * as S from "@/lib/requests-sql";

const q = (text: string, params: unknown[] = []) => raw().query(text, params) as Promise<Row[]>;

export type RequestRow = {
  kind: RequestKind; id: string; status: string; message: string; created_at: string; responded_at: string | null;
  intro_sent_at: string | null; intro_error: string | null; requester: string; requester_name: string;
  requester_profile_visible: boolean; responders: string[]; responder_name: string | null; subject_title: string;
  subject_href: string; context: string | null; extra: string | null;
};

export const requestUrl = (kind: RequestKind, id: string) => `${SITE_URL}${KIND_INFO[kind].path(id)}`;

/** Lazy 30-day expiry (no cron). */
export async function expireAll(): Promise<void> {
  try { for (const s of S.EXPIRE_ALL_SQL) await q(s); } catch (e) { console.error("request expiry failed", e); }
}

export const sentLastDayAll = async (userId: string) => Number((await q(S.SENT_LAST_DAY_ALL_SQL, [userId]))[0]?.n ?? 0);
export const sentLastDayKind = async (kind: keyof typeof S.SENT_LAST_DAY_KIND_SQL, userId: string) =>
  Number((await q(S.SENT_LAST_DAY_KIND_SQL[kind], [userId]))[0]?.n ?? 0);
export const hasOpen = async (kind: RequestKind, targetId: string, userId: string) => (await q(S.HAS_OPEN_SQL[kind], [targetId, userId])).length > 0;

export async function listForUser(kind: RequestKind, userId: string): Promise<{ received: RequestRow[]; sent: RequestRow[] }> {
  const rows = (await q(S.LIST_SQL[kind], [userId])) as unknown as RequestRow[];
  return { received: rows.filter((r) => r.responders.includes(userId)), sent: rows.filter((r) => r.requester === userId) };
}

export const getOne = async (kind: RequestKind, id: string) => ((await q(S.ONE_SQL[kind], [id]))[0] as unknown as RequestRow) ?? null;

export const adminOfferRequests = async () => (await q(S.ADMIN_OFFER_REQUESTS_SQL)) as unknown as RequestRow[];
export const partnerOfferRequests = async (partnerId: string) => (await q(S.PARTNER_OFFER_REQUESTS_SQL, [partnerId])) as unknown as RequestRow[];
export const partnerHelpOffers = async (partnerId: string) => (await q(S.PARTNER_HELP_OFFERS_SQL, [partnerId])) as unknown as RequestRow[];

// ---------- Create ----------

export async function createHelpOffer(needId: string, helperId: string, message: string, partnerId: string | null): Promise<string | null> {
  return ((await q(S.HELP_INSERT_SQL, [needId, helperId, message, partnerId]))[0]?.id as string) ?? null;
}
export async function createOfferRequest(offerId: string, userId: string, message: string, projectId: string | null): Promise<string | null> {
  return ((await q(S.OFFER_REQUEST_INSERT_SQL, [offerId, userId, message, projectId]))[0]?.id as string) ?? null;
}

export async function createMentorshipRequest(mentorId: string, menteeId: string, message: string, projectId: string | null): Promise<string | null> {
  return ((await q(S.MENTORSHIP_INSERT_SQL, [mentorId, menteeId, message, projectId]))[0]?.id as string) ?? null;
}
export async function createInvestorInterest(ideaId: string, investorId: string, message: string): Promise<string | null> {
  return ((await q(S.INVESTOR_INSERT_SQL, [ideaId, investorId, message]))[0]?.id as string) ?? null;
}

// ---------- Emails ----------

/** Tell the responder(s) a request arrived. No addresses in the notice. Offer requests on partners without
 *  contacts go to the admin inbox as a link-only notice. */
export async function notifyResponder(kind: RequestKind, id: string): Promise<void> {
  try {
    const [p] = await q(S.PARTIES_SQL[kind], [id]);
    if (!p) return;
    const to = (p.notify_emails as string[]).filter(Boolean);
    const url = requestUrl(kind, id);
    let msg: EmailMessage | null = null;
    if (kind === "collab") {
      if (to.length) msg = newRequestEmail({ ownerEmail: to[0], ideaName: p.subject_title, requesterName: p.requester_name, message: p.message, requestId: id });
    } else if (kind === "help") {
      if (to.length) msg = helpOfferNoticeEmail({ to, ideaName: p.subject_title, needTitle: p.context, helperName: p.requester_name, onBehalfOf: p.extra, message: p.message, url });
    } else if (kind === "mentorship") {
      if (to.length) msg = mentorshipNoticeEmail({ to, menteeName: p.requester_name, ideaName: p.context, message: p.message, url });
    } else if (kind === "investor") {
      if (to.length) msg = investorInterestNoticeEmail({ to, ideaName: p.subject_title, investorName: p.requester_name, investorType: label(INVESTOR_TYPES, p.context ?? "other"), organization: p.extra, message: p.message, url });
    } else if (Number(p.contact_count) === 0) {
      msg = offerRequestNoticeEmail({ to: [adminNotifyAddress()], offerTitle: p.subject_title, partnerName: p.context, requesterName: "", message: "", url: `${SITE_URL}/admin/partners#offer-requests`, forAdmin: true });
    } else if (to.length) {
      msg = offerRequestNoticeEmail({ to, offerTitle: p.subject_title, partnerName: p.context, requesterName: p.requester_name, message: p.message, url });
    }
    if (!msg) return;
    // One email per recipient so a partner's contacts never see each other's addresses.
    let delivered = false;
    for (const addr of msg.to) {
      const res = await sendEmail({ ...msg, to: [addr] });
      delivered = delivered || res.ok || !!(res as { skipped?: boolean }).skipped;
    }
    if (delivered) await q(S.NOTIFIED_SQL[kind], [id]);
  } catch (e) {
    console.error("request notice failed", e);
  }
}

function introFor(kind: RequestKind, p: Row): EmailMessage | null {
  if (!p.requester_email) return null;
  if (kind === "collab") {
    if (!p.responder_email) return null;
    return introductionEmail({ ownerEmail: p.responder_email, ownerName: p.responder_name, requesterEmail: p.requester_email,
      requesterName: p.requester_name, ideaName: p.subject_title, ideaId: String(p.href).split("/").pop()!, message: p.message });
  }
  if (kind === "help") {
    if (!p.responder_email) return null;
    return requestIntroEmail({
      a: { email: p.responder_email, name: p.responder_name }, b: { email: p.requester_email, name: p.requester_name },
      subject: `PANA introduction: help with "${p.context}"`,
      opening: `${p.responder_name} accepted ${p.requester_name}'s offer to help with "${p.context}" on "${p.subject_title}"${p.extra ? ` (offered for ${p.extra})` : ""}. Here are your email addresses so you can talk directly.`,
      message: p.message, url: `${SITE_URL}${p.href}`,
    });
  }
  if (kind === "mentorship") {
    if (!p.responder_email) return null;
    return requestIntroEmail({
      a: { email: p.responder_email, name: p.responder_name }, b: { email: p.requester_email, name: p.requester_name },
      subject: "PANA introduction: mentorship",
      opening: `${p.responder_name} accepted ${p.requester_name}'s mentorship request${p.context ? ` for "${p.context}"` : ""}. Here are your email addresses so you can agree how and when to meet. Mentoring on PANA is volunteer and unpaid. ${NOT_VETTED}`,
      message: p.message, url: `${SITE_URL}${p.href}`,
    });
  }
  if (kind === "investor") {
    if (!p.responder_email) return null;
    return requestIntroEmail({
      a: { email: p.responder_email, name: p.responder_name }, b: { email: p.requester_email, name: p.requester_name },
      subject: `PANA introduction: investor interest in "${p.subject_title}"`,
      opening: `${p.responder_name} accepted ${p.requester_name}'s interest in "${p.subject_title}". Here are your email addresses so you can talk directly. ${NOT_VETTED} Do your own checks before sharing confidential information or agreeing to anything.`,
      message: p.message, url: `${SITE_URL}${p.href}`,
    });
  }
  // offer: the accepting partner contact, or PANA (admin inbox) when the admin accepted
  const responder = p.responder_email ? { email: p.responder_email as string, name: p.responder_name as string } : { email: adminNotifyAddress(), name: "PANA" };
  return requestIntroEmail({
    a: responder, b: { email: p.requester_email, name: p.requester_name },
    subject: `PANA introduction: ${p.subject_title} (${p.context})`,
    opening: `${responder.name === "PANA" ? `PANA accepted ${p.requester_name}'s request` : `${responder.name} (${p.context}) accepted ${p.requester_name}'s request`} for "${p.subject_title}". Here are your email addresses so you can arrange the details directly.`,
    message: p.message, url: `${SITE_URL}${p.href}`,
  });
}

async function sendIntro(kind: RequestKind, id: string): Promise<{ sent: boolean; error?: string }> {
  const [p] = await q(S.PARTIES_SQL[kind], [id]);
  const msg = p ? introFor(kind, p) : null;
  if (!msg) {
    await q(S.INTRO_RESULT_SQL[kind], [id, false, null, "missing member email"]);
    return { sent: false, error: "missing member email" };
  }
  const res = await sendEmail(msg);
  await q(S.INTRO_RESULT_SQL[kind], [id, res.ok, res.ok ? res.id : null, res.ok ? null : res.error]);
  return res.ok ? { sent: true } : { sent: false, error: res.error };
}

async function sendDecline(kind: RequestKind, id: string): Promise<void> {
  const [p] = await q(S.PARTIES_SQL[kind], [id]);
  if (!p?.requester_email) return;
  const msg = kind === "collab"
    ? declinedEmail({ requesterEmail: p.requester_email, ideaName: p.subject_title })
    : kind === "mentorship"
      ? requestDeclinedEmail({ to: p.requester_email, subject: "Update on your mentorship request", line: `${p.responder_name} can't take on your mentorship request right now. Other mentors may be a good fit.`, nextUrl: `${SITE_URL}/mentors` })
    : kind === "investor"
      ? requestDeclinedEmail({ to: p.requester_email, subject: `Update on your interest in "${p.subject_title}"`, line: `The owner of "${p.subject_title}" isn't taking up investor conversations right now.`, nextUrl: `${SITE_URL}/ideas?open_to_investment=1` })
    : kind === "help"
      ? requestDeclinedEmail({ to: p.requester_email, subject: `Update on your offer to help`, line: `Thanks for offering to help with "${p.context}". The idea owner isn't taking up the offer right now.`, nextUrl: `${SITE_URL}/ideas` })
      : requestDeclinedEmail({ to: p.requester_email, subject: `Update on your request for "${p.subject_title}"`, line: `Your request for "${p.subject_title}" (${p.context}) wasn't accepted this time.`, nextUrl: `${SITE_URL}/incubator/resources` });
  await sendEmail(msg);
}

// ---------- Respond / withdraw / retry ----------

export type RespondResult = { ok: false } | { ok: true; status: "accepted" | "declined"; intro?: { sent: boolean; error?: string } };

/** Accept/decline. The SQL re-checks who may answer (owner; for offers a partner contact, or an admin). */
export async function respond(kind: RequestKind, id: string, actorId: string, to: "accepted" | "declined", isAdmin: boolean): Promise<RespondResult> {
  const rows = await q(S.RESPOND_SQL[kind], [id, actorId, to, kind === "offer" ? isAdmin : false]);
  if (!rows.length) return { ok: false };
  if (to === "declined") {
    try { await sendDecline(kind, id); } catch (e) { console.error("decline email failed", e); }
    return { ok: true, status: to };
  }
  let intro: { sent: boolean; error?: string };
  try { intro = await sendIntro(kind, id); } catch (e) { intro = { sent: false, error: String(e) }; }
  return { ok: true, status: to, intro };
}

/** Retry a failed introduction: responder (or admin), accepted and not yet sent. */
export async function retryIntro(kind: RequestKind, id: string, actorId: string, isAdmin: boolean): Promise<{ sent: boolean; error?: string } | null> {
  const r = await getOne(kind, id);
  if (!r || r.status !== "accepted" || r.intro_sent_at) return null;
  if (!isAdmin && !r.responders.includes(actorId)) return null;
  return sendIntro(kind, id);
}

export const withdraw = async (kind: RequestKind, id: string, requesterId: string) => (await q(S.WITHDRAW_SQL[kind], [id, requesterId])).length > 0;
