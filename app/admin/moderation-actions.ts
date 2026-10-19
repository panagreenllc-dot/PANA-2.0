"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isClerkUserId } from "@/lib/clerk-sync";
import { parseProjectId } from "@/lib/ids";

const BACKS = ["/admin/reports", "/admin/profiles"];
function back(fd: FormData) {
  const b = String(fd.get("back") ?? "");
  return BACKS.includes(b) ? b : "/admin/reports";
}
function done(fd: FormData, msg?: string): never {
  revalidatePath("/admin", "layout");
  revalidatePath("/members");
  redirect(msg ? `${back(fd)}?error=${encodeURIComponent(msg)}` : back(fd));
}
function target(fd: FormData): string {
  const id = String(fd.get("userId") ?? "");
  if (!isClerkUserId(id)) done(fd, "Invalid member id.");
  return id;
}
function note(fd: FormData): string {
  return String(fd.get("note") ?? "").trim().slice(0, 300);
}

export async function hideProfile(fd: FormData) {
  const admin = await requireAdmin();
  const id = target(fd);
  const reason = note(fd) || "Hidden by admin";
  const r = await sql`UPDATE profiles SET moderation = 'hidden', hidden_reason = ${reason}, updated_at = now() WHERE user_id = ${id} RETURNING user_id`;
  if (!r.length) done(fd, "Profile not found.");
  await sql`UPDATE reports SET status = 'actioned', resolved_by = ${admin.id}, resolved_at = now()
            WHERE target_type = 'profile' AND target_id = ${id} AND status = 'open'`;
  await audit(admin.id, "hide", "profile", id, reason);
  done(fd);
}

export async function unhideProfile(fd: FormData) {
  const admin = await requireAdmin();
  const id = target(fd);
  const r = await sql`UPDATE profiles SET moderation = 'ok', hidden_reason = NULL, updated_at = now() WHERE user_id = ${id} RETURNING user_id`;
  if (!r.length) done(fd, "Profile not found.");
  // Clear the open reports so the auto-hide rule doesn't immediately re-trigger.
  await sql`UPDATE reports SET status = 'dismissed', resolved_by = ${admin.id}, resolved_at = now()
            WHERE target_type = 'profile' AND target_id = ${id} AND status = 'open'`;
  await audit(admin.id, "unhide", "profile", id, note(fd) || undefined);
  done(fd);
}

export async function unpublishProfile(fd: FormData) {
  const admin = await requireAdmin();
  const id = target(fd);
  const r = await sql`UPDATE profiles SET is_published = false, published_at = NULL, updated_at = now() WHERE user_id = ${id} RETURNING user_id`;
  if (!r.length) done(fd, "Profile not found.");
  await audit(admin.id, "unpublish", "profile", id, note(fd) || undefined);
  done(fd);
}

export async function resolveReport(fd: FormData) {
  const admin = await requireAdmin();
  const id = parseProjectId(fd.get("reportId")); // validates UUID format
  if (!id || !id.includes("-")) done(fd, "Invalid report id.");
  const status = fd.get("resolution") === "actioned" ? "actioned" : "dismissed";
  const r = await sql`UPDATE reports SET status = ${status}, resolved_by = ${admin.id}, resolved_at = now()
                      WHERE id::text = ${id} AND status = 'open' RETURNING target_type, target_id`;
  if (!r.length) done(fd, "Report not found or already resolved.");
  await audit(admin.id, status === "actioned" ? "report_actioned" : "report_dismissed", "report", id, `${r[0].target_type}:${r[0].target_id}`);
  done(fd);
}

function ideaTarget(fd: FormData): string {
  const id = parseProjectId(fd.get("ideaId"));
  if (!id) done(fd, "Invalid idea id.");
  return id;
}

export async function hideIdea(fd: FormData) {
  const admin = await requireAdmin();
  const id = ideaTarget(fd);
  const r = await sql`UPDATE projects SET hidden_by_reports = true, updated_at = now() WHERE id::text = ${id} RETURNING id`;
  if (!r.length) done(fd, "Idea not found.");
  await sql`UPDATE reports SET status = 'actioned', resolved_by = ${admin.id}, resolved_at = now()
            WHERE target_type = 'idea' AND target_id = ${id} AND status = 'open'`;
  await audit(admin.id, "hide", "idea", id, note(fd) || undefined);
  revalidatePath("/ideas");
  done(fd);
}

export async function restoreIdea(fd: FormData) {
  const admin = await requireAdmin();
  const id = ideaTarget(fd);
  const r = await sql`UPDATE projects SET hidden_by_reports = false, updated_at = now() WHERE id::text = ${id} RETURNING id`;
  if (!r.length) done(fd, "Idea not found.");
  // Dismiss open reports so the 3-report auto-hide doesn't immediately re-trigger.
  await sql`UPDATE reports SET status = 'dismissed', resolved_by = ${admin.id}, resolved_at = now()
            WHERE target_type = 'idea' AND target_id = ${id} AND status = 'open'`;
  await audit(admin.id, "unhide", "idea", id, note(fd) || undefined);
  revalidatePath("/ideas");
  done(fd);
}
