// Community feed, events and the member board (P3-4). Pure helpers (no I/O) so they can be unit-tested.
// PANA only connects people: board posts can't carry contact details or money amounts, like every other member text.
import { parseEasternLocal } from "@/lib/datetime";
import { slugify } from "@/lib/incubator";
import { hasMoneyAmount, MONEY_ERROR } from "@/lib/mentors";
import { containsContactInfo } from "@/lib/profile-input";

export const POST_KINDS = [
  { value: "question", label: "Question", hint: "Ask the community something" },
  { value: "ask", label: "Looking for help", hint: "Need a hand, a tester or advice?" },
  { value: "win", label: "Win", hint: "Share progress or a milestone" },
  { value: "tip", label: "Tip", hint: "Share something useful you learned" },
] as const;
export type PostKind = (typeof POST_KINDS)[number]["value"];
export const kindLabel = (k: string) => POST_KINDS.find((x) => x.value === k)?.label ?? k;

export const BOARD_LIMITS = { title: [5, 120], body: [20, 2000], reply: [2, 1000], note: 500 } as const;
export const POSTS_PER_DAY = 5;
export const REPLIES_PER_DAY = 30;

export const FEED_LIMITS = { title: [3, 140], body: 5000, location: 120, address: 200, regNote: 120, price: 80, url: 500, agenda: 30, speakers: 30 } as const;
export const DIGEST_INTERVAL_DAYS = 14; // at most ~2 digests a month
export const DIGEST_BATCH = 90;         // per send, under Resend's free 100/day
export const DIGEST_MAX_POSTS = 20;
export const DEFAULT_REG_NOTE = "Registration opens soon";

const CONTACT_ERROR = "Please don't include email addresses or phone numbers. Members reply here, and PANA introduces people when both agree.";

const clean = (v: unknown) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").replace(/\r\n/g, "\n").trim();
const oneLine = (v: unknown) => clean(v).replace(/\s+/g, " ");

export type MemberPostInput = { kind: PostKind; title: string; body: string };

export function parseMemberPost(fd: FormData): { data?: MemberPostInput; error?: string } {
  const kind = String(fd.get("kind") ?? "");
  const title = oneLine(fd.get("title"));
  const body = clean(fd.get("body"));
  if (!POST_KINDS.some((k) => k.value === kind)) return { error: "Choose what kind of post this is." };
  if (title.length < BOARD_LIMITS.title[0] || title.length > BOARD_LIMITS.title[1]) return { error: `Give your post a title (${BOARD_LIMITS.title[0]}–${BOARD_LIMITS.title[1]} characters).` };
  if (body.length < BOARD_LIMITS.body[0] || body.length > BOARD_LIMITS.body[1]) return { error: `Write ${BOARD_LIMITS.body[0]}–${BOARD_LIMITS.body[1]} characters.` };
  const all = `${title}\n${body}`;
  if (containsContactInfo(all)) return { error: CONTACT_ERROR };
  if (hasMoneyAmount(all)) return { error: "Please leave out money amounts. PANA connects people; it doesn't handle money or deals." };
  return { data: { kind: kind as PostKind, title, body } };
}

export function parseReply(fd: FormData): { data?: string; error?: string } {
  const body = clean(fd.get("body"));
  if (body.length < BOARD_LIMITS.reply[0] || body.length > BOARD_LIMITS.reply[1]) return { error: `Replies are ${BOARD_LIMITS.reply[0]}–${BOARD_LIMITS.reply[1]} characters.` };
  if (containsContactInfo(body)) return { error: CONTACT_ERROR };
  if (hasMoneyAmount(body)) return { error: "Please leave out money amounts. PANA connects people; it doesn't handle money or deals." };
  return { data: body };
}

/**
 * The light moderation rule John approves: a member's FIRST contribution (post or reply) waits for his review.
 * Once he has approved one, later posts and replies publish straight away (reports and removal still apply).
 */
export function initialStatus(hasApprovedContribution: boolean): "pending" | "published" {
  return hasApprovedContribution ? "published" : "pending";
}

/** Which admin decisions are allowed from a status. */
export function canModerate(from: string, decision: "approve" | "decline" | "remove" | "restore"): boolean {
  if (decision === "approve" || decision === "decline") return from === "pending";
  if (decision === "remove") return from === "published" || from === "pending";
  return from === "removed" || from === "declined";
}

// ---- John's announcements and events ----

export type FeedInput = {
  kind: "announcement" | "event"; title: string; slug: string; body: string; program: "community" | "incubator" | "techcon";
  audience: "public" | "members"; pinned: boolean; starts_at: Date | null; ends_at: Date | null; location_name: string | null;
  address: string | null; is_online: boolean; registration_url: string | null; registration_note: string | null; price_text: string | null;
  agenda: { time_label: string; title: string }[]; speakers: { name: string; role: string }[];
};

/** "10:30 AM | Doors open" lines → agenda items. A line without "|" is a title with no time. */
export function parseAgendaLines(raw: unknown): { time_label: string; title: string }[] {
  return clean(raw).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, FEED_LIMITS.agenda).map((l) => {
    const i = l.indexOf("|");
    return i < 0 ? { time_label: "", title: oneLine(l).slice(0, 140) } : { time_label: oneLine(l.slice(0, i)).slice(0, 40), title: oneLine(l.slice(i + 1)).slice(0, 140) };
  }).filter((a) => a.title);
}

/** "Name | Role" lines → speakers. */
export function parseSpeakerLines(raw: unknown): { name: string; role: string }[] {
  return clean(raw).split("\n").map((l) => l.trim()).filter(Boolean).slice(0, FEED_LIMITS.speakers).map((l) => {
    const i = l.indexOf("|");
    return i < 0 ? { name: oneLine(l).slice(0, 100), role: "" } : { name: oneLine(l.slice(0, i)).slice(0, 100), role: oneLine(l.slice(i + 1)).slice(0, 140) };
  }).filter((s) => s.name);
}

export const agendaToLines = (a: { time_label: string; title: string }[]) => a.map((x) => (x.time_label ? `${x.time_label} | ${x.title}` : x.title)).join("\n");
export const speakersToLines = (s: { name: string; role: string }[]) => s.map((x) => (x.role ? `${x.name} | ${x.role}` : x.name)).join("\n");

export function parseFeedPost(fd: FormData): { data?: FeedInput; error?: string } {
  const kind = fd.get("kind") === "event" ? "event" : "announcement";
  const title = oneLine(fd.get("title"));
  const body = clean(fd.get("body"));
  const slug = slugify(oneLine(fd.get("slug")) || title).slice(0, 80).replace(/-+$/, "");
  const programRaw = String(fd.get("program") ?? "community");
  const program = (["community", "incubator", "techcon"] as const).find((p) => p === programRaw) ?? "community";
  const audience = fd.get("audience") === "members" ? "members" : "public";
  const startsRaw = String(fd.get("starts_at") ?? "").trim();
  const endsRaw = String(fd.get("ends_at") ?? "").trim();
  const starts_at = startsRaw ? parseEasternLocal(startsRaw) : null;
  const ends_at = endsRaw ? parseEasternLocal(endsRaw) : null;
  const opt = (k: string) => oneLine(fd.get(k)) || null;
  const location_name = opt("location_name"), address = opt("address"), registration_note = opt("registration_note"), price_text = opt("price_text");
  const registration_url = opt("registration_url");
  if (title.length < FEED_LIMITS.title[0] || title.length > FEED_LIMITS.title[1]) return { error: `Title must be ${FEED_LIMITS.title[0]}–${FEED_LIMITS.title[1]} characters.` };
  if (!slug) return { error: "Add a short web address (letters and numbers)." };
  if (body.length > FEED_LIMITS.body) return { error: `Text must be under ${FEED_LIMITS.body} characters.` };
  if ((startsRaw && !starts_at) || (endsRaw && !ends_at)) return { error: "Times must be valid (Eastern Time)." };
  if (kind === "event" && !starts_at) return { error: "Events need a start time." };
  if (starts_at && ends_at && ends_at <= starts_at) return { error: "The event must end after it starts." };
  if ((location_name?.length ?? 0) > FEED_LIMITS.location || (address?.length ?? 0) > FEED_LIMITS.address) return { error: "Venue or address is too long." };
  if ((registration_note?.length ?? 0) > FEED_LIMITS.regNote || (price_text?.length ?? 0) > FEED_LIMITS.price) return { error: "Registration note or price is too long." };
  if (registration_url && (!/^https?:\/\/[^\s]+$/i.test(registration_url) || registration_url.length > FEED_LIMITS.url)) return { error: "The registration link must start with https://." };
  return { data: {
    kind, title, slug, body, program, audience, pinned: fd.get("pinned") === "on", starts_at, ends_at, location_name, address,
    is_online: fd.get("is_online") === "on", registration_url, registration_note, price_text,
    agenda: kind === "event" ? parseAgendaLines(fd.get("agenda")) : [], speakers: kind === "event" ? parseSpeakerLines(fd.get("speakers")) : [],
  } };
}

/** Digest timing: at most one new digest every 14 days; a started digest continues in batches at most once a day. */
export function digestState(last: { created_at: Date | string; last_batch_at: Date | string | null; remaining: number } | null, now = new Date()):
  { canStart: boolean; canContinue: boolean; nextStart: Date | null } {
  if (!last) return { canStart: true, canContinue: false, nextStart: null };
  const created = new Date(last.created_at).getTime();
  const nextStart = new Date(created + DIGEST_INTERVAL_DAYS * 86_400_000);
  const lastBatch = last.last_batch_at ? new Date(last.last_batch_at).getTime() : created;
  return {
    canStart: now >= nextStart && last.remaining === 0,
    canContinue: last.remaining > 0 && now.getTime() - lastBatch >= 86_400_000,
    nextStart,
  };
}

// ---- Calendar (.ics) and maps ----

const icsDate = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/([,;])/g, "\\$1");
function fold(line: string): string {
  const out: string[] = [];
  for (let i = 0; i < line.length; i += 73) out.push((i ? " " : "") + line.slice(i, i + 73));
  return out.join("\r\n");
}

/** A minimal RFC 5545 event, all times in UTC. */
export function buildIcs(e: { uid: string; title: string; starts_at: Date; ends_at: Date | null; location?: string | null; description?: string | null; url: string }, now = new Date()): string {
  const end = e.ends_at ?? new Date(e.starts_at.getTime() + 2 * 3600_000);
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//PANA 2.0//Community events//EN", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${e.uid}@panagreen.org`, `DTSTAMP:${icsDate(now)}`, `DTSTART:${icsDate(e.starts_at)}`, `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(e.title)}`,
    ...(e.location ? [`LOCATION:${icsText(e.location)}`] : []),
    `DESCRIPTION:${icsText(`${(e.description ?? "").slice(0, 800)}\n\n${e.url}`.trim())}`,
    `URL:${e.url}`, "END:VEVENT", "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

export const mapsUrl = (venue: string | null, address: string | null) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([venue, address].filter(Boolean).join(", "))}`;

export { MONEY_ERROR };
