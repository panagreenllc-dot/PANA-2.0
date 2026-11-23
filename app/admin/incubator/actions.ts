"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { DECISIONS, parseCohort, parseUuid, type Decision } from "@/lib/incubator";
import {
  acceptedCount, createCohort, decideApplication, getCohort, notifyInterested, saveAdminNote, setCohortStatus,
  setParticipantStatus, updateCohort,
} from "@/lib/incubator-repo";

const back = (cohortId: string | null, q: Record<string, string>) =>
  `/admin/incubator${cohortId ? `/${cohortId}` : ""}?${new URLSearchParams(q).toString()}`;
const isUniqueViolation = (e: unknown) => (e as { code?: string })?.code === "23505";
const refresh = () => { revalidatePath("/admin", "layout"); revalidatePath("/incubator"); revalidatePath("/me"); };

export async function createCohortAction(fd: FormData) {
  const admin = await requireAdmin();
  const { data, error } = parseCohort(fd);
  if (!data) redirect(back(null, { error: error ?? "Invalid cohort." }));
  let id: string;
  try {
    id = await createCohort(data, admin.id);
  } catch (e) {
    console.error("createCohort failed", e);
    redirect(back(null, { error: isUniqueViolation(e) ? "That web name (slug) is already used." : "Database error. Please try again." }));
  }
  await audit(admin.id, "create_cohort", "cohort", id, data.name);
  refresh();
  redirect(back(id, { notice: "created" }));
}

export async function updateCohortAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  if (!id) redirect(back(null, { error: "Invalid cohort." }));
  const { data, error } = parseCohort(fd);
  if (!data) redirect(back(id, { error: error ?? "Invalid cohort." }));
  let ok = false;
  try {
    ok = await updateCohort(id, data);
  } catch (e) {
    console.error("updateCohort failed", e);
    redirect(back(id, { error: isUniqueViolation(e) ? "That web name (slug) is already used." : "Database error. Please try again." }));
  }
  if (!ok) redirect(back(null, { error: "Cohort not found." }));
  await audit(admin.id, "update_cohort", "cohort", id, `status=${data.status}`);
  refresh();
  redirect(back(id, { notice: "saved" }));
}

export async function cohortStatusAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  const status = String(fd.get("status") ?? "");
  if (!id) redirect(back(null, { error: "Invalid cohort." }));
  if (!(await setCohortStatus(id, status))) redirect(back(id, { error: "Couldn't change status (set a close date before opening)." }));
  await audit(admin.id, `cohort_${status}`, "cohort", id);
  refresh();
  redirect(back(id, { notice: `status-${status}` }));
}

// One action per button (formAction), like app/admin/page.tsx: React does not send the
// clicked button's name/value with a server-action form, so a shared name="decision" arrives empty.
export async function acceptApplicationAction(fd: FormData) { await decide(fd, "accepted"); }
export async function waitlistApplicationAction(fd: FormData) { await decide(fd, "waitlisted"); }
export async function declineApplicationAction(fd: FormData) { await decide(fd, "declined"); }
export async function reviewApplicationAction(fd: FormData) { await decide(fd, "under_review"); }

async function decide(fd: FormData, to: Decision) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  const cohortId = parseUuid(fd.get("cohort_id"));
  const note = String(fd.get("note") ?? "").trim().slice(0, 1000) || null;
  const adminNote = String(fd.get("admin_note") ?? "").trim().slice(0, 2000) || null;
  if (!id || !cohortId || !(DECISIONS as readonly string[]).includes(to)) redirect(back(cohortId, { error: "Invalid decision." }));
  if (to === "accepted" && fd.get("over_capacity") !== "on") {
    const cohort = await getCohort(cohortId);
    if (cohort && cohort.capacity != null && (await acceptedCount(cohortId)) >= cohort.capacity) {
      redirect(back(cohortId, { error: `This cohort reached its soft limit (${cohort.capacity}). Tick "accept anyway" to accept.`, open: id }));
    }
  }
  const r = await decideApplication(id, admin.id, to, note, adminNote);
  if (!r.ok) redirect(back(cohortId, { error: "That decision isn't possible from the application's current status." }));
  await audit(admin.id, `application_${to}`, "application", id, note ?? undefined);
  refresh();
  redirect(back(cohortId, { notice: `decided-${to}`, email: r.email ?? "none" }));
}

export async function participantAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  const cohortId = parseUuid(fd.get("cohort_id"));
  const s = String(fd.get("participant_status") ?? "");
  if (!id || !cohortId || !(await setParticipantStatus(id, s))) redirect(back(cohortId, { error: "Couldn't update participant." }));
  await audit(admin.id, `participant_${s}`, "application", id);
  refresh();
  redirect(back(cohortId, { notice: "participant" }));
}

export async function adminNoteAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  const cohortId = parseUuid(fd.get("cohort_id"));
  const note = String(fd.get("admin_note") ?? "").trim().slice(0, 2000) || null;
  if (!id || !cohortId || !(await saveAdminNote(id, note))) redirect(back(cohortId, { error: "Couldn't save note." }));
  await audit(admin.id, "application_note", "application", id);
  redirect(back(cohortId, { notice: "note" }));
}

export async function notifyInterestedAction(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseUuid(fd.get("id"));
  if (!id) redirect(back(null, { error: "Invalid cohort." }));
  const r = await notifyInterested(id);
  if (!r) redirect(back(id, { error: "Already sent, or the cohort isn't open." }));
  await audit(admin.id, "cohort_notify", "cohort", id, `sent=${r.sent} skipped=${r.skipped}`);
  refresh();
  redirect(back(id, { notice: "notified", sent: String(r.sent), skipped: String(r.skipped) }));
}
