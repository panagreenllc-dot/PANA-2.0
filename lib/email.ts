// Transactional email via Resend's REST API (no SDK). Never throws: failures are returned and logged.
// Requires RESEND_API_KEY and a verified sending domain (mail.panagreen.org) in Resend.

export const DEFAULT_FROM = "PANA 2.0 <notify@mail.panagreen.org>";
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://panagreen.org";

export type EmailMessage = { to: string[]; subject: string; text: string; html?: string; replyTo?: string[] };
export type SendResult = { ok: true; id: string } | { ok: false; error: string; skipped?: boolean };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function textToHtml(text: string): string {
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#111">${escapeHtml(text)
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, "<br>")}</div>`;
}

export async function sendEmail(msg: EmailMessage, opts: { fetchImpl?: typeof fetch; apiKey?: string; from?: string } = {}): Promise<SendResult> {
  const apiKey = opts.apiKey ?? process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY is not set; not sending "${msg.subject}"`);
    return { ok: false, skipped: true, error: "RESEND_API_KEY not set" };
  }
  const recipients = msg.to.filter((t) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t));
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
