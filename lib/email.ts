// Transactional email via Resend's REST API (no SDK). Never throws: failures are returned and logged.
// Requires RESEND_API_KEY and a verified sending domain (mail.panagreen.org) in Resend.

export const DEFAULT_FROM = "PANA 2.0 <notify@mail.panagreen.org>";
import { CONTACT_EMAIL } from "@/lib/site";

/** Links in emails. Preview deployments link to their own branch URL so testers don't land on production. */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  || (process.env.VERCEL_ENV === "preview" && process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : "https://panagreen.org");

/** Where admin notices go (link-only, no member content). Defaults to the PANA contact inbox. */
export function adminNotifyAddress(): string {
  const v = (process.env.ADMIN_NOTIFY_EMAIL || "").trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : CONTACT_EMAIL;
}

/** RFC 2606 / test domains (e.g. Clerk "+clerk_test@example.com" users): never sent, only logged. */
export function isReservedAddress(addr: string): boolean {
  const domain = addr.split("@").pop()?.toLowerCase() ?? "";
  return /(^|\.)(example\.(com|net|org)|example|test|invalid|localhost)$/.test(domain);
}

/** "jo***@example.com", for logs. */
export function maskEmail(addr: string): string {
  const [u, d] = addr.split("@");
  return d ? `${u.slice(0, 2)}***@${d}` : "***";
}

export type EmailMessage = { to: string[]; subject: string; text: string; html?: string; replyTo?: string[] };
export type SendResult = { ok: true; id: string } | { ok: false; error: string; skipped?: boolean };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function textToHtml(text: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111">${escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>")}</div>`;
}

export async function sendEmail(msg: EmailMessage, opts: { fetchImpl?: typeof fetch; apiKey?: string; from?: string; allowReserved?: boolean } = {}): Promise<SendResult> {
  const valid = msg.to.filter((t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t));
  const reserved = opts.allowReserved ? [] : valid.filter(isReservedAddress);
  if (reserved.length && reserved.length === valid.length) {
    console.info(`[email] test address, logged not sent: "${msg.subject}" to ${reserved.map(maskEmail).join(", ")}`);
    return { ok: false, skipped: true, error: "test address (not sent)" };
  }
  const apiKey = opts.apiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY is not set; not sending "${msg.subject}"`);
    return { ok: false, skipped: true, error: "RESEND_API_KEY not set" };
  }
  const recipients = valid.filter((t) => !reserved.includes(t));
  if (recipients.length === 0) return { ok: false, error: "no valid recipients" };
  try {
    const res = await (opts.fetchImpl ?? fetch)("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: opts.from ?? process.env.EMAIL_FROM ?? DEFAULT_FROM,
        to: recipients,
        subject: msg.subject,
        text: msg.text,
        html: msg.html ?? textToHtml(msg.text),
        ...(msg.replyTo?.length ? { reply_to: msg.replyTo } : {}),
      }),
    });
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok || !body.id) {
      const error = `Resend ${res.status}: ${body.message ?? body.name ?? "unknown error"}`.slice(0, 300);
      console.error(`[email] ${error}`);
      return { ok: false, error };
    }
    console.info(`[email] sent "${msg.subject}" to ${recipients.map(maskEmail).join(", ")} (id ${body.id})`);
    return { ok: true, id: body.id };
  } catch (e) {
    const error = `network error: ${(e as Error).message}`.slice(0, 300);
    console.error(`[email] ${error}`);
    return { ok: false, error };
  }
}

// ---- Templates (plain text; no member emails appear except in the accepted introduction) ----

export function newRequestEmail(p: { ownerEmail: string; ideaName: string; requesterName: string; message: string; requestId: string }): EmailMessage {
  return {
    to: [p.ownerEmail],
    subject: `Someone is interested in "${p.ideaName}"`,
    text: `${p.requesterName} would like to collaborate on your idea "${p.ideaName}" on PANA 2.0.\n\nTheir note:\n"${p.message}"\n\nAccept or decline here: ${SITE_URL}/me/requests/${p.requestId}\n\nYour email address has not been shared. If you accept, PANA will introduce you both by email. Requests expire after 30 days.\n\nManage email preferences: ${SITE_URL}/me`,
  };
}

export function introductionEmail(p: { ownerEmail: string; ownerName: string; requesterEmail: string; requesterName: string; ideaName: string; ideaId: string; message: string }): EmailMessage {
  return {
    to: [p.ownerEmail, p.requesterEmail],
    replyTo: [p.ownerEmail, p.requesterEmail],
    subject: `Introduction: ${p.ownerName} <> ${p.requesterName} (${p.ideaName})`,
    text: `Hi ${p.ownerName} and ${p.requesterName},\n\n${p.ownerName} accepted ${p.requesterName}'s request to collaborate on "${p.ideaName}" on PANA 2.0, so we're introducing you.\n\n${p.ownerName}: ${p.ownerEmail}\n${p.requesterName}: ${p.requesterEmail}\n\n${p.requesterName}'s original note:\n"${p.message}"\n\nReply-all to start the conversation. Idea: ${SITE_URL}/ideas/${p.ideaId}\n\nPANA introduces members but doesn't vet them. Take care when sharing personal or confidential information. Report concerns from the idea or profile page.\n\nPANA 2.0 · Where Community Meets Innovation`,
  };
}

export function declinedEmail(p: { requesterEmail: string; ideaName: string }): EmailMessage {
  return {
    to: [p.requesterEmail],
    subject: `Update on your request for "${p.ideaName}"`,
    text: `Thanks for offering to collaborate on "${p.ideaName}". The owner isn't taking this one forward right now.\n\nThere are plenty more ideas looking for help: ${SITE_URL}/ideas\n\nManage email preferences: ${SITE_URL}/me`,
  };
}

// ---- Phase 3: incubator + idea review results (each goes only to the member it is about) ----

const FOOTER = `\n\nManage email preferences: ${SITE_URL}/me\n\nPANA 2.0 · Where Community Meets Innovation`;

export function applicationReceivedEmail(p: { to: string; name: string; cohortName: string; ideaName: string | null; announceText?: string }): EmailMessage {
  return {
    to: [p.to],
    subject: `We received your application to ${p.cohortName}`,
    text: `Hi ${p.name},\n\nThanks for applying to the PANA incubator, ${p.cohortName}${p.ideaName ? `, with "${p.ideaName}"` : ""}.\n\nJohn and the PANA team review every application. ${p.announceText ?? "We'll email you when there's a decision."}\n\nYou can check the status or withdraw any time: ${SITE_URL}/me\n\nA reminder: PANA connects participants with mentors, community partners and sponsors. PANA itself doesn't give out money or equipment.${FOOTER}`,
  };
}

export function applicationDecisionEmail(p: { to: string; name: string; cohortName: string; decision: "accepted" | "waitlisted" | "declined"; note: string | null; startsText?: string; badge?: boolean }): EmailMessage {
  const subject = {
    accepted: `You're in: welcome to ${p.cohortName}`,
    waitlisted: `You're on the waitlist for ${p.cohortName}`,
    declined: `Update on your ${p.cohortName} application`,
  }[p.decision];
  const body = {
    accepted: `Congratulations! You've been accepted into ${p.cohortName}.${p.startsText ? ` The program starts ${p.startsText}.` : ""} We'll be in touch with next steps.`,
    waitlisted: `Your application for ${p.cohortName} is on the waitlist. If there's room later, we'll let you know. In the meantime you're welcome in the PANA community: ask questions and share progress on the community board (${SITE_URL}/community/board) and find a volunteer mentor (${SITE_URL}/mentors).`,
    declined: `Thank you for applying to ${p.cohortName}. We aren't able to place you in this cohort, but we'd love for you to stay part of the PANA community: ask questions and share progress on the community board (${SITE_URL}/community/board), find a volunteer mentor (${SITE_URL}/mentors), and apply again to a future cohort.`,
  }[p.decision];
  return {
    to: [p.to],
    subject,
    text: `Hi ${p.name},\n\n${body}${p.note ? `\n\nA note from the PANA team:\n"${p.note}"` : ""}${p.decision === "accepted" && p.badge ? `\n\nYour PANA incubator badge is ready. Show it at partner locations (with a photo ID) to use participant-only access like lab or library time: ${SITE_URL}/me/badge\nPartner offers you can use: ${SITE_URL}/incubator/resources` : ""}\n\nYour application: ${SITE_URL}/me${FOOTER}`,
  };
}

/** Link-only notice to the admin inbox: no applicant name, idea or answers. */
export function adminNewApplicationEmail(p: { to: string; cohortId: string }): EmailMessage {
  return {
    to: [p.to],
    subject: "New PANA incubator application",
    text: `A new incubator application is waiting for review.\n\nReview it in admin (sign in required): ${SITE_URL}/admin/incubator/${p.cohortId}\n\nThis notice has no applicant details by design.`,
  };
}

export function ideaReviewEmail(p: { to: string; ideaName: string; ideaId: string; outcome: "approved" | "changes_requested" | "rejected"; note: string | null }): EmailMessage {
  const line = {
    approved: `Good news: your idea "${p.ideaName}" was approved and is now live on PANA 2.0.\n\nSee it here: ${SITE_URL}/ideas/${p.ideaId}`,
    changes_requested: `Your idea "${p.ideaName}" needs a few changes before it can go live.\n\nEdit it here: ${SITE_URL}/ideas/${p.ideaId}/edit`,
    rejected: `Thanks for sharing "${p.ideaName}". We weren't able to publish it this time.`,
  }[p.outcome];
  const subject = { approved: `Your idea is live: ${p.ideaName}`, changes_requested: `Changes requested: ${p.ideaName}`, rejected: `Update on your idea: ${p.ideaName}` }[p.outcome];
  return { to: [p.to], subject, text: `${line}${p.note ? `\n\nNote from the reviewer:\n"${p.note}"` : ""}${FOOTER}` };
}

export function cohortOpenEmail(p: { to: string; cohortName: string; closesText: string }): EmailMessage {
  return {
    to: [p.to],
    subject: `Applications are open: ${p.cohortName}`,
    text: `You asked us to tell you when PANA incubator applications open.\n\n${p.cohortName} is now accepting applications${p.closesText ? ` until ${p.closesText}` : ""}.\n\nApply here: ${SITE_URL}/incubator\n\nYou won't get this email again for this cohort. To stop incubator news, turn it off at ${SITE_URL}/me${FOOTER}`,
  };
}

// ---- Phase 3 / P3-2a: partner inquiries ----

/** Confirmation to whoever filled the public partner form (their own address only). */
export function inquiryThanksEmail(p: { to: string; name: string; orgName: string }): EmailMessage {
  return {
    to: [p.to],
    subject: "Thanks for your interest in partnering with PANA",
    text: `Hi ${p.name},\n\nThanks for reaching out about ${p.orgName} supporting PANA projects. John from PANA will be in touch.\n\nPANA connects local builders with community partners. Partners provide access directly, such as lab or library time, mentorship, software credits or space. PANA itself doesn't handle money.\n\nIf you didn't send this, you can ignore this email.\n\nPANA 2.0 · Where Community Meets Innovation`,
  };
}

/** Link-only notice to the admin inbox: no organization or contact details. */
export function adminNewInquiryEmail(p: { to: string }): EmailMessage {
  return {
    to: [p.to],
    subject: "New PANA partner inquiry",
    text: `Someone filled in the "Become a partner" form.\n\nSee it in admin (sign in required): ${SITE_URL}/admin/partners\n\nThis notice has no contact details by design.`,
  };
}

// ---- Phase 3 / P3-2b: help offers, offer requests, needs and partner notices ----
// Same rule as collaboration: a notice never contains an address; the ONLY email that shares addresses is the
// introduction, sent after the responder accepts.

const SAFETY = "PANA introduces members but doesn't vet them. Take care when sharing personal or confidential information.";

export function helpOfferNoticeEmail(p: { to: string[]; ideaName: string; needTitle: string; helperName: string; onBehalfOf: string | null; message: string; url: string }): EmailMessage {
  return {
    to: p.to,
    subject: `Someone offered to help: "${p.needTitle}"`,
    text: `${p.helperName}${p.onBehalfOf ? ` (for ${p.onBehalfOf})` : ""} offered to help with your need "${p.needTitle}" on "${p.ideaName}".\n\nTheir note:\n"${p.message}"\n\nAccept or decline here: ${p.url}\n\nYour email address has not been shared. If you accept, PANA will introduce you both by email. Offers expire after 30 days.${FOOTER}`,
  };
}

export function offerRequestNoticeEmail(p: { to: string[]; offerTitle: string; partnerName: string; requesterName: string; message: string; url: string; forAdmin?: boolean }): EmailMessage {
  return {
    to: p.to,
    subject: `New request for "${p.offerTitle}"`,
    text: p.forAdmin
      ? `A PANA member requested "${p.offerTitle}" (${p.partnerName}). This partner has no linked contacts yet, so PANA answers it.\n\nReview it (sign in required): ${p.url}\n\nThis notice has no member details by design.`
      : `${p.requesterName} would like to use "${p.offerTitle}" from ${p.partnerName}, through PANA.\n\nTheir note:\n"${p.message}"\n\nAccept or decline here: ${p.url}\n\nTheir email address has not been shared, and neither has yours. If you accept, PANA will introduce you both by email. Requests expire after 30 days.${FOOTER}`,
  };
}

/** The one email that shares both addresses, after an accepted help offer or offer request. */
export function requestIntroEmail(p: { a: { email: string; name: string }; b: { email: string; name: string }; subject: string; opening: string; message: string; url: string }): EmailMessage {
  return {
    to: [p.a.email, p.b.email],
    replyTo: [p.a.email, p.b.email],
    subject: p.subject,
    text: `Hi ${p.a.name} and ${p.b.name},\n\n${p.opening}\n\n${p.a.name}: ${p.a.email}\n${p.b.name}: ${p.b.email}\n\nThe original note:\n"${p.message}"\n\nReply-all to start the conversation. ${p.url}\n\n${SAFETY} Report concerns from the page on PANA.\n\nPANA 2.0 · Where Community Meets Innovation`,
  };
}

export function requestDeclinedEmail(p: { to: string; subject: string; line: string; nextUrl: string }): EmailMessage {
  return { to: [p.to], subject: p.subject, text: `${p.line}\n\nThere's more to explore: ${p.nextUrl}${FOOTER}` };
}

export function needReviewEmail(p: { to: string; needTitle: string; ideaName: string; ideaId: string; outcome: "approved" | "changes_requested"; note: string | null }): EmailMessage {
  return p.outcome === "approved"
    ? { to: [p.to], subject: `Your need is live: ${p.needTitle}`, text: `Your need "${p.needTitle}" on "${p.ideaName}" was approved. Members who can see your idea can now offer help.\n\nSee it: ${SITE_URL}/ideas/${p.ideaId}#needs${FOOTER}` }
    : { to: [p.to], subject: `Changes requested: ${p.needTitle}`, text: `Your need "${p.needTitle}" on "${p.ideaName}" needs a few changes before it goes live.${p.note ? `\n\nNote from the reviewer:\n"${p.note}"` : ""}\n\nEdit it here: ${SITE_URL}/ideas/${p.ideaId}#needs${FOOTER}` };
}

/** Status notice to a partner's contacts ("your offer is live" / "needs changes" / listing updates). */
export function partnerNoticeEmail(p: { to: string[]; partnerName: string; subject: string; line: string; note?: string | null }): EmailMessage {
  return {
    to: p.to,
    subject: p.subject,
    text: `${p.line}${p.note ? `\n\nNote from PANA:\n"${p.note}"` : ""}\n\nPartner portal (sign in required): ${SITE_URL}/partner\n\nYou're getting this because you're listed as a contact for ${p.partnerName} on PANA.\n\nPANA 2.0 · Where Community Meets Innovation`,
  };
}

/** Link-only notice to the admin inbox when a partner contact submits an offer or listing change. */
export function adminPartnerUpdateEmail(p: { to: string; what: "offer" | "listing" }): EmailMessage {
  return {
    to: [p.to],
    subject: p.what === "offer" ? "New partner offer waiting for review" : "Partner listing changes waiting for review",
    text: `A partner contact submitted ${p.what === "offer" ? "an offer" : "listing changes"} on PANA.\n\nReview in admin (sign in required): ${SITE_URL}/admin/partners\n\nThis notice has no details by design.`,
  };
}

// ---- Phase 3 / P3-3: mentors and investors ----
// Same rule: notices never contain an address; only the accepted introduction shares both.

export const NOT_VETTED = "PANA doesn't vet mentors or investors, doesn't give investment advice, and doesn't take part in any deal or agreement between members.";

export function mentorshipNoticeEmail(p: { to: string[]; menteeName: string; ideaName: string | null; message: string; url: string }): EmailMessage {
  return {
    to: p.to,
    subject: "New mentorship request on PANA",
    text: `${p.menteeName} would like your mentorship${p.ideaName ? ` on their idea "${p.ideaName}"` : ""}.\n\nTheir note:\n"${p.message}"\n\nAccept or decline here: ${p.url}\n\nYour email address has not been shared. If you accept, PANA will introduce you both by email. Requests expire after 30 days. You can pause new requests any time from your profile.${FOOTER}`,
  };
}

export function investorInterestNoticeEmail(p: { to: string[]; ideaName: string; investorName: string; investorType: string; organization: string | null; message: string; url: string }): EmailMessage {
  return {
    to: p.to,
    subject: `An investor is interested in "${p.ideaName}"`,
    text: `${p.investorName} (${p.investorType}${p.organization ? `, ${p.organization}` : ""}), a PANA-approved investor, is interested in your idea "${p.ideaName}".\n\nTheir note:\n"${p.message}"\n\nAccept or decline here: ${p.url}\n\nYour email address has not been shared. If you accept, PANA will introduce you both by email. ${NOT_VETTED} You can turn off investor interest on your idea's page.${FOOTER}`,
  };
}

/** Result of John's review of a mentor/investor application. */
export function roleDecisionEmail(p: { to: string; role: "mentor" | "investor"; decision: "approved" | "declined" | "revoked"; note: string | null }): EmailMessage {
  const r = p.role === "mentor" ? "mentor" : "investor";
  const note = p.note ? `\n\nNote from PANA:\n"${p.note}"` : "";
  const text = p.decision === "approved"
    ? (p.role === "mentor"
      ? `You're now a PANA mentor. Your mentor badge is on your profile, and members can find you in the mentor directory and send mentorship requests. You'll get an email for each one and decide whether to accept.${note}\n\nManage it here: ${SITE_URL}/me/profile#mentor`
      : `You're now a PANA-approved investor. A badge is on your profile, and you can say you're interested in ideas whose owners opened them to investor interest: ${SITE_URL}/ideas?open_to_investment=1\n\nOwners decide whether to be introduced. ${NOT_VETTED}${note}`)
    : p.decision === "declined"
      ? `Thanks for applying to be a PANA ${r}. We can't approve it right now.${note}\n\nYou can update it and re-apply: ${SITE_URL}/me/profile#${r}`
      : `Your PANA ${r} badge has been removed.${note}\n\nQuestions? See how to contact PANA: ${SITE_URL}/terms`;
  return { to: [p.to], subject: p.decision === "approved" ? `You're approved as a PANA ${r}` : `Update on your PANA ${r} application`, text: `${text}${FOOTER}` };
}

/** Link-only notice to the admin inbox. */
export function adminNewRoleApplicationEmail(p: { to: string; role: "mentor" | "investor" }): EmailMessage {
  return {
    to: [p.to],
    subject: `New ${p.role} application on PANA`,
    text: `A member applied (or updated their application) to be a PANA ${p.role}.\n\nReview in admin (sign in required): ${SITE_URL}/admin/mentors\n\nThis notice has no member details by design.`,
  };
}

// ---------- Community (P3-4) ----------

/** Link-only notice: a member's first board post or reply is waiting for review. No member content by design. */
export function adminBoardReviewEmail(p: { to: string }): EmailMessage {
  return {
    to: [p.to],
    subject: "A first community board post is waiting for review",
    text: `A member's first post or reply on the PANA community board is waiting for your review.\n\nReview in admin (sign in required): ${SITE_URL}/admin/community\n\nThis notice has no member details by design.`,
  };
}

export function boardDecisionEmail(p: { to: string; title: string; decision: "published" | "declined"; note: string | null; url: string }): EmailMessage {
  const body = p.decision === "published"
    ? `Your community board post "${p.title}" is live for PANA members: ${p.url}\n\nFrom now on, your posts and replies appear straight away.`
    : `Thanks for posting on the PANA community board. Your post "${p.title}" wasn't approved this time.${p.note ? `\n\nA note from the PANA team:\n"${p.note}"` : ""}\n\nYou're welcome to post again: ${SITE_URL}/community/board`;
  return { to: [p.to], subject: p.decision === "published" ? "Your community post is live" : "About your community post", text: `${body}${FOOTER}` };
}

export type DigestItem = { title: string; url: string; when?: string; summary?: string };

/** The opt-in announcements & events digest (John's posts only, never member posts). */
export function communityDigestEmail(p: { to: string; items: DigestItem[] }): EmailMessage {
  const lines = p.items.map((i) => `• ${i.title}${i.when ? ` (${i.when})` : ""}\n  ${i.summary ? `${i.summary}\n  ` : ""}${i.url}`).join("\n\n");
  return {
    to: [p.to],
    subject: "PANA community: announcements and upcoming events",
    text: `Hi,\n\nHere's what's new in the PANA community:\n\n${lines}\n\nSee everything: ${SITE_URL}/community\n\nYou're getting this because you turned on the community digest (about twice a month at most). Turn it off any time: ${SITE_URL}/me#email${FOOTER}`,
  };
}
