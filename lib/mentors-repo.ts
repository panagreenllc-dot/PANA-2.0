// Mentor and investor roles (P3-3): data access + review emails. SQL in lib/mentors-sql.ts (tested on PGlite).
import sql, { raw, type Row } from "@/lib/db";
import { adminNewRoleApplicationEmail, adminNotifyAddress, roleDecisionEmail, sendEmail } from "@/lib/email";
import { canAdminDecide, investorChanged, mentorChanged, roleStatusAfterSave, type InvestorInput, type MentorInput } from "@/lib/mentors";
import * as S from "@/lib/mentors-sql";

const q = (text: string, params: unknown[] = []) => raw().query(text, params) as Promise<Row[]>;

export type MentorRow = {
  user_id: string; name: string; headline: string | null; profile_visible: boolean; status: string; expertise: string[];
  bio: string; availability: string | null; max_open_mentees: number; open_load: number; member_status?: string; moderation?: string;
};
export type RoleRow = { role: "mentor" | "investor"; user_id: string; name: string; status: string; bio: string; tags: string[];
  detail: string | null; organization: string | null; review_note: string | null; created_at: string; updated_at: string; approved_at: string | null };

export const myMentor = async (userId: string) => (await q(S.MY_MENTOR_SQL, [userId]))[0] ?? null;
export const myInvestor = async (userId: string) => (await q(S.MY_INVESTOR_SQL, [userId]))[0] ?? null;
export const badgesOf = async (userId: string) => ((await q(S.BADGES_SQL, [userId]))[0] ?? { mentor: false, investor: false }) as { mentor: boolean; investor: boolean };
export const isApprovedInvestor = async (userId: string | null) => !!userId && (await q(S.IS_INVESTOR_SQL, [userId])).length > 0;
export const mentorDirectory = async (expertise: string | null) => (await q(S.DIRECTORY_SQL, [expertise])) as unknown as MentorRow[];
export const mentorOne = async (userId: string) => ((await q(S.MENTOR_ONE_SQL, [userId]))[0] as unknown as MentorRow) ?? null;
export const adminPending = async () => (await q(S.ADMIN_PENDING_SQL)) as unknown as RoleRow[];
export const adminDecided = async () => (await q(S.ADMIN_DECIDED_SQL)) as unknown as RoleRow[];
export const adminPendingCount = async () => Number((await q(S.ADMIN_PENDING_COUNT_SQL))[0]?.n ?? 0);

async function notifyAdmin(role: "mentor" | "investor") {
  try { await sendEmail(adminNewRoleApplicationEmail({ to: adminNotifyAddress(), role })); } catch (e) { console.error("admin notice failed", e); }
}

/** Save the member's mentor form. Returns the new status, or null if PANA revoked it (can't self-restore). */
export async function saveMentor(userId: string, d: MentorInput): Promise<string | null> {
  const prev = await myMentor(userId);
  const status = roleStatusAfterSave(prev ? { status: String(prev.status), changed: mentorChanged(prev as never, d) } : null);
  if (!status) return null;
  const [r] = await q(S.MENTOR_UPSERT_SQL, [userId, d.expertise, d.bio, d.availability, d.max_open_mentees, status]);
  if (!r) return null;
  if (r.status === "pending" && prev?.status !== "pending") await notifyAdmin("mentor");
  return String(r.status);
}

export async function saveInvestor(userId: string, d: InvestorInput): Promise<string | null> {
  const prev = await myInvestor(userId);
  const status = roleStatusAfterSave(prev ? { status: String(prev.status), changed: investorChanged(prev as never, d) } : null);
  if (!status) return null;
  const [r] = await q(S.INVESTOR_UPSERT_SQL, [userId, d.investor_type, d.focus_categories, d.stage_focus, d.organization, d.bio, status]);
  if (!r) return null;
  if (r.status === "pending" && prev?.status !== "pending") await notifyAdmin("investor");
  return String(r.status);
}

export const pauseMentor = async (userId: string, to: "pause" | "resume") => (await q(S.MENTOR_PAUSE_SQL, [userId, to])).length > 0;
export const removeRole = async (role: "mentor" | "investor", userId: string) =>
  (await q(role === "mentor" ? S.MENTOR_DELETE_SQL : S.INVESTOR_DELETE_SQL, [userId])).length > 0;

const ALLOWED_FROM: Record<"approve" | "decline" | "revoke", string[]> = {
  approve: ["pending", "declined", "revoked"], decline: ["pending"], revoke: ["approved", "paused"],
};
const TO: Record<"approve" | "decline" | "revoke", "approved" | "declined" | "revoked"> = { approve: "approved", decline: "declined", revoke: "revoked" };

/** John's decision. Re-checked in SQL (status = ANY(allowed)). Emails the member (no other addresses). */
export async function decideRole(role: "mentor" | "investor", userId: string, decision: "approve" | "decline" | "revoke", adminId: string, note: string | null): Promise<boolean> {
  const allowed = ALLOWED_FROM[decision].filter((s) => canAdminDecide(s, decision));
  const [r] = await q(role === "mentor" ? S.MENTOR_DECIDE_SQL : S.INVESTOR_DECIDE_SQL, [userId, TO[decision], adminId, note, allowed]);
  if (!r) return false;
  try {
    const [m] = await sql`SELECT email, status, email_prefs FROM members WHERE user_id = ${userId}`;
    if (m?.email && m.status === "active" && m.email_prefs?.reviews !== false) {
      await sendEmail(roleDecisionEmail({ to: m.email, role, decision: TO[decision], note }));
    }
  } catch (e) {
    console.error("role decision email failed", e);
  }
  return true;
}

export const setInvestorOpen = async (ideaId: string, ownerId: string, open: boolean) =>
  (await q(S.SET_INVESTOR_OPEN_SQL, [ideaId, ownerId, open])).length > 0;

export const reportRole = async (reporter: string, type: "mentor_profile" | "investor_profile", targetId: string, reason: string, details: string | null) =>
  (await q(S.ROLE_REPORT_INSERT_SQL, [reporter, type, targetId, reason, details])).length > 0;
