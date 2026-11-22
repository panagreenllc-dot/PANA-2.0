// Incubator data access (Neon) + the emails it triggers. SQL lives in lib/incubator-sql.ts (tested on PGlite).
import sql, { raw, type Row } from "@/lib/db";
import { formatDateTime, formatDay } from "@/lib/datetime";
import {
  adminNewApplicationEmail, adminNotifyAddress, applicationDecisionEmail, applicationReceivedEmail, cohortOpenEmail, sendEmail,
} from "@/lib/email";
import type { ApplicationInput, CohortInput, Decision } from "@/lib/incubator";
import {
  ACCEPTED_COUNT_SQL, ADMIN_COHORTS_SQL, ADMIN_NOTE_SQL, ADMIN_QUEUE_SQL, APPLY_INSERT_SQL, COHORT_ACCEPTING_SQL, COHORT_COLS,
  DECIDE_SQL, DECISION_PARTIES_SQL, MY_APPLICATIONS_SQL, NOTIFY_TARGETS_SQL, PARTICIPANT_SQL, PENDING_APPLICATIONS_SQL,
  PREFS_MERGE_SQL, PUBLIC_COHORTS_SQL, WITHDRAW_APPLICATION_SQL,
} from "@/lib/incubator-sql";

const q = (text: string, params: unknown[] = []) => raw().query(text, params) as Promise<Row[]>;

export const publicCohorts = () => q(PUBLIC_COHORTS_SQL);
export const acceptingCohort = async (id: string) => (await q(COHORT_ACCEPTING_SQL, [id]))[0] ?? null;
export const myApplications = (userId: string) => q(MY_APPLICATIONS_SQL, [userId]);
export const adminCohorts = () => q(ADMIN_COHORTS_SQL);
export const adminQueue = (cohortId: string) => q(ADMIN_QUEUE_SQL, [cohortId]);
export const acceptedCount = async (cohortId: string) => ((await q(ACCEPTED_COUNT_SQL, [cohortId]))[0]?.n as number) ?? 0;
export const pendingApplications = async () => ((await q(PENDING_APPLICATIONS_SQL))[0]?.n as number) ?? 0;

export async function getCohort(id: string): Promise<Row | null> {
  return (await q(`SELECT ${COHORT_COLS} FROM incubator_cohorts c WHERE c.id::text = $1`, [id]))[0] ?? null;
}

/** The member's ideas that can be used to apply (not rejected or withdrawn). */
export async function applicableIdeas(userId: string): Promise<Row[]> {
  return sql`SELECT id::text AS id, project_name, status, stage FROM projects
             WHERE user_id = ${userId} AND status IN ('pending', 'approved', 'changes_requested')
             ORDER BY updated_at DESC NULLS LAST LIMIT 50`;
}

export async function hasLiveApplication(cohortId: string, userId: string): Promise<boolean> {
  const r = await sql`SELECT 1 FROM incubator_applications WHERE cohort_id::text = ${cohortId} AND user_id = ${userId}
                      AND status NOT IN ('withdrawn', 'declined') LIMIT 1`;
  return r.length > 0;
}

export function announceText(c: { announce_on?: string | null; announce_note?: string | null }): string | undefined {
  if (!c.announce_on && !c.announce_note) return undefined;
  const when = c.announce_on ? formatDay(c.announce_on) : "";
  return [c.announce_note, when && `(${when})`].filter(Boolean).join(" ") + ".";
}

const prefOn = (prefs: unknown, key: string) => (prefs as Record<string, unknown> | null)?.[key] !== false;

export async function submitApplication(userId: string, d: ApplicationInput): Promise<string | null> {
  const rows = await q(APPLY_INSERT_SQL, [d.cohort_id, userId, d.project_id, d.stage, d.goals, d.weekly_hours, d.needs,
    d.team || null, JSON.stringify(d.links)]);
  const id = (rows[0]?.id as string) ?? null;
  if (!id) return null;
  // Best effort: confirmation to the applicant (their own address), link-only notice to the admin inbox.
  try {
    const [p] = await q(DECISION_PARTIES_SQL, [id]);
    if (p?.email && prefOn(p.email_prefs, "incubator")) {
      await sendEmail(applicationReceivedEmail({ to: p.email, name: p.name, cohortName: p.cohort_name, ideaName: p.project_name, announceText: announceText(p) }));
    }
    await sendEmail(adminNewApplicationEmail({ to: adminNotifyAddress(), cohortId: d.cohort_id }));
  } catch (e) {
    console.error("application emails failed", e);
  }
  return id;
}

export const withdrawApplication = async (id: string, userId: string) => (await q(WITHDRAW_APPLICATION_SQL, [id, userId])).length > 0;

export type DecideResult = { ok: false } | { ok: true; status: Decision; email?: "sent" | "skipped" | "failed" };

export async function decideApplication(id: string, adminId: string, to: Decision, note: string | null, adminNote: string | null): Promise<DecideResult> {
  const rows = await q(DECIDE_SQL, [id, adminId, to, note, adminNote]);
  if (!rows.length) return { ok: false };
  if (to === "under_review") return { ok: true, status: to };
  const [p] = await q(DECISION_PARTIES_SQL, [id]);
  if (!p?.email || p.member_status !== "active" || !prefOn(p.email_prefs, "incubator")) return { ok: true, status: to, email: "skipped" };
  const res = await sendEmail(applicationDecisionEmail({
    to: p.email, name: p.name, cohortName: p.cohort_name, decision: to, note: p.decision_note,
    startsText: p.starts_on ? formatDay(p.starts_on) : undefined,
  }));
  return { ok: true, status: to, email: res.ok ? "sent" : (res as { skipped?: boolean }).skipped ? "skipped" : "failed" };
}

export const setParticipantStatus = async (id: string, s: string) => (await q(PARTICIPANT_SQL, [id, s])).length > 0;
export const saveAdminNote = async (id: string, note: string | null) => (await q(ADMIN_NOTE_SQL, [id, note])).length > 0;

export async function createCohort(d: CohortInput, adminId: string): Promise<string> {
  const [r] = await sql`
    INSERT INTO incubator_cohorts (name, slug, summary, format, status, apply_opens_at, apply_closes_at, starts_on, ends_on,
                                   announce_on, announce_note, capacity, created_by)
    VALUES (${d.name}, ${d.slug}, ${d.summary}, ${d.format}, ${d.status}, ${d.apply_opens_at?.toISOString() ?? null},
            ${d.apply_closes_at?.toISOString() ?? null}, ${d.starts_on}, ${d.ends_on}, ${d.announce_on}, ${d.announce_note},
            ${d.capacity}, ${adminId})
    RETURNING id::text AS id`;
  return r.id;
}

export async function updateCohort(id: string, d: CohortInput): Promise<boolean> {
  const rows = await sql`
    UPDATE incubator_cohorts SET name = ${d.name}, slug = ${d.slug}, summary = ${d.summary}, format = ${d.format},
      status = ${d.status}, apply_opens_at = ${d.apply_opens_at?.toISOString() ?? null},
      apply_closes_at = ${d.apply_closes_at?.toISOString() ?? null}, starts_on = ${d.starts_on}, ends_on = ${d.ends_on},
      announce_on = ${d.announce_on}, announce_note = ${d.announce_note}, capacity = ${d.capacity}, updated_at = now()
    WHERE id::text = ${id} RETURNING id`;
  return rows.length > 0;
}

export async function setCohortStatus(id: string, status: string): Promise<boolean> {
  const rows = await sql`UPDATE incubator_cohorts SET status = ${status}, updated_at = now()
                         WHERE id::text = ${id} AND ${status} IN ('draft', 'open', 'closed', 'active', 'completed')
                           AND (${status} <> 'open' OR apply_closes_at IS NOT NULL) RETURNING id`;
  return rows.length > 0;
}

/** Number of members waiting for a "notify me" email (shown in admin before sending). */
export async function notifyCount(): Promise<number> {
  const [r] = await sql`SELECT count(*)::int AS n FROM members WHERE status = 'active' AND email IS NOT NULL
                        AND (email_prefs->>'incubator_news')::boolean IS TRUE`;
  return r?.n ?? 0;
}

/** One-time "applications are open" email per cohort, capped for the Resend free tier. */
export async function notifyInterested(cohortId: string, cap = 90): Promise<{ sent: number; skipped: number } | null> {
  const claimed = await sql`UPDATE incubator_cohorts SET notified_at = now(), updated_at = now()
                            WHERE id::text = ${cohortId} AND status = 'open' AND notified_at IS NULL
                            RETURNING name, apply_closes_at`;
  if (!claimed.length) return null;
  const targets = await q(NOTIFY_TARGETS_SQL, [cap]);
  let sent = 0, skipped = 0;
  for (const t of targets) {
    const r = await sendEmail(cohortOpenEmail({ to: t.email, cohortName: claimed[0].name, closesText: formatDateTime(claimed[0].apply_closes_at) }));
    if (r.ok) sent++; else skipped++;
  }
  return { sent, skipped };
}

export async function mergePrefs(userId: string, patch: Record<string, boolean>): Promise<void> {
  await q(PREFS_MERGE_SQL, [userId, JSON.stringify(patch)]);
}
