// Needs on ideas (P3-2b): data access + review emails. SQL in lib/needs-sql.ts (tested on PGlite).
import sql, { raw, type Row } from "@/lib/db";
import { needReviewEmail, sendEmail } from "@/lib/email";
import { MAX_ACTIVE_NEEDS, needStatusAfterEdit, type NeedInput } from "@/lib/needs";
import type { NeedRow } from "@/lib/visibility";
import * as S from "@/lib/needs-sql";

const q = (text: string, params: unknown[] = []) => raw().query(text, params) as Promise<Row[]>;

export const ideaNeeds = async (ideaId: string) => (await q(S.IDEA_NEEDS_SQL, [ideaId])) as unknown as NeedRow[];
export const needWithIdea = async (needId: string) => (await q(S.NEED_WITH_IDEA_SQL, [needId]))[0] ?? null;
export const myNeeds = (userId: string) => q(S.MY_NEEDS_SQL, [userId]);
export const pendingNeeds = () => q(S.PENDING_NEEDS_SQL);
export const pendingNeedsCount = async () => Number((await q(S.PENDING_NEEDS_COUNT_SQL))[0]?.n ?? 0);
export const publicOpenNeeds = (limit = 6) => q(S.PUBLIC_OPEN_NEEDS_SQL, [limit]);

/** Returns the new id, or null when the idea isn't the owner's or the active-need limit is reached. */
export async function createNeed(ideaId: string, ownerId: string, d: NeedInput): Promise<string | null> {
  return ((await q(S.NEED_INSERT_SQL, [ideaId, ownerId, d.kind, d.title, d.details, d.amount_text, MAX_ACTIVE_NEEDS]))[0]?.id as string) ?? null;
}

/** Owner edit; any wording change sends the need back to review. */
export async function updateNeed(needId: string, ownerId: string, d: NeedInput): Promise<{ status: string } | null> {
  const cur = await needWithIdea(needId);
  if (!cur || cur.owner_user_id !== ownerId || cur.status === "closed") return null;
  const status = needStatusAfterEdit(cur as never, d);
  return ((await q(S.NEED_UPDATE_SQL, [needId, ownerId, d.kind, d.title, d.details, d.amount_text, status]))[0] as { status: string }) ?? null;
}

export async function setNeedStatusByOwner(needId: string, ownerId: string, from: string, to: string): Promise<boolean> {
  return (await q(S.NEED_OWNER_STATUS_SQL, [needId, ownerId, to, from])).length > 0;
}

export async function reviewNeed(needId: string, decision: "approve" | "send_back", adminId: string, note: string | null): Promise<Row | null> {
  const [r] = await q(S.NEED_REVIEW_SQL, [needId, decision, adminId, note]);
  if (!r) return null;
  try {
    const [m] = await sql`SELECT m.email, m.email_prefs, m.status, p.project_name FROM members m JOIN projects p ON p.id::text = ${r.project_id}
                          WHERE m.user_id = ${r.owner_user_id}`;
    if (m?.email && m.status === "active" && m.email_prefs?.reviews !== false) {
      await sendEmail(needReviewEmail({ to: m.email, needTitle: r.title, ideaName: m.project_name, ideaId: r.project_id,
        outcome: decision === "approve" ? "approved" : "changes_requested", note }));
    }
  } catch (e) {
    console.error("need review email failed", e);
  }
  return r;
}
