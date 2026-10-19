"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sql, { type Row } from "@/lib/db";
import { parseProjectId } from "@/lib/ids";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { parseIdea, type IdeaFormState } from "@/lib/ideas";
import { updateIdeaByAdmin } from "@/lib/ideas-repo";

function refresh() {
  revalidatePath("/", "layout");
}

function backPath(formData: FormData): string {
  const b = String(formData.get("back") ?? "");
  return b === "/admin" || b === "/admin/projects" ? b : "/admin";
}

function fail(formData: FormData, message: string): never {
  redirect(`${backPath(formData)}?error=${encodeURIComponent(message)}`);
}

/** Validates the project id from the form; redirects with an error if invalid. */
function idOf(formData: FormData): string {
  const id = parseProjectId(formData.get("id"));
  if (!id) fail(formData, "Invalid project id.");
  return id;
}

async function run(formData: FormData, query: () => Promise<Row[]>, notFoundMsg: string) {
  let rows: Row[];
  try {
    rows = await query();
  } catch (e) {
    console.error("Admin project action failed", e);
    fail(formData, "Database error — please try again.");
  }
  if (rows.length === 0) fail(formData, notFoundMsg);
  refresh();
}

// ----- Projects -----

export async function approveProject(formData: FormData) {
  const admin = await requireAdmin();
  const id = idOf(formData);
  await run(formData, () => sql`
    UPDATE projects SET status = 'approved', moderation_note = NULL, reviewed_at = now(), reviewed_by = ${admin.id}, updated_at = now()
    WHERE id::text = ${id} RETURNING id`, "Project not found (it may already have been removed).");
  await audit(admin.id, "approve", "idea", id);
}

export async function unpublishProject(formData: FormData) {
  const admin = await requireAdmin();
  const id = idOf(formData);
  await run(formData, () => sql`
    UPDATE projects SET status = 'pending', reviewed_at = now(), reviewed_by = ${admin.id}, updated_at = now()
    WHERE id::text = ${id} RETURNING id`, "Project not found (it may already have been removed).");
  await audit(admin.id, "unpublish", "idea", id);
}

export async function deleteProject(formData: FormData) {
  const admin = await requireAdmin();
  const id = idOf(formData);
  await run(formData, () => sql`DELETE FROM projects WHERE id::text = ${id} RETURNING id`,
    "Project not found (it may already have been deleted).");
  await audit(admin.id, "delete", "idea", id);
}

export async function updateProject(rawId: string, _prev: IdeaFormState, formData: FormData): Promise<IdeaFormState> {
  const admin = await requireAdmin();
  const id = parseProjectId(rawId);
  if (!id) return { error: "Invalid project id." };
  const { data, state } = parseIdea(formData);
  if (!data) return state!;
  let ok = false;
  try {
    ok = await updateIdeaByAdmin(id, data);
  } catch (e) {
    console.error("updateProject failed", e);
    return { error: "Database error — please try again.", values: data };
  }
  if (!ok) return { error: "Project not found.", values: data };
  await audit(admin.id, "edit", "idea", id);
  refresh();
  redirect("/admin/projects");
}

async function setReviewStatus(formData: FormData, status: "changes_requested" | "rejected") {
  const admin = await requireAdmin();
  const id = idOf(formData);
  const note = String(formData.get("note") ?? "").trim().slice(0, 500) || null;
  await run(formData, () => sql`
    UPDATE projects SET status = ${status}, moderation_note = ${note}, reviewed_at = now(), reviewed_by = ${admin.id}, updated_at = now()
    WHERE id::text = ${id} RETURNING id`, "Project not found (it may already have been removed).");
  await audit(admin.id, status === "rejected" ? "reject" : "request_changes", "idea", id, note ?? undefined);
}

export async function requestChanges(formData: FormData) {
  await setReviewStatus(formData, "changes_requested");
}

export async function rejectProject(formData: FormData) {
  await setReviewStatus(formData, "rejected");
}

// ----- Members -----

function userIdOf(formData: FormData): string {
  const id = String(formData.get("userId") ?? "");
  if (!id.startsWith("user_")) throw new Error("Invalid user id");
  return id;
}

async function guardNotSelf(formData: FormData) {
  const admin = await requireAdmin();
  const target = userIdOf(formData);
  if (target === admin.id) throw new Error("You can't perform this action on your own account.");
  return { target, admin };
}

export async function setAdmin(formData: FormData) {
  const { target, admin } = await guardNotSelf(formData);
  const makeAdmin = formData.get("makeAdmin") === "true";
  const client = await clerkClient();
  const user = await client.users.getUser(target);
  await client.users.updateUserMetadata(target, {
    publicMetadata: { ...user.publicMetadata, role: makeAdmin ? "admin" : null },
  });
  await audit(admin.id, makeAdmin ? "grant_admin" : "revoke_admin", "member", target);
  revalidatePath("/admin/members");
}

export async function setBanned(formData: FormData) {
  const { target, admin } = await guardNotSelf(formData);
  const client = await clerkClient();
  const ban = formData.get("ban") === "true";
  if (ban) await client.users.banUser(target);
  else await client.users.unbanUser(target);
  await sql`UPDATE members SET status = ${ban ? "banned" : "active"}, updated_at = now() WHERE user_id = ${target} AND status <> 'deleted'`.catch(
    (e) => console.error("member status sync failed", e));
  await audit(admin.id, ban ? "ban" : "unban", "member", target);
  revalidatePath("/admin/members");
}

export async function deleteMember(formData: FormData) {
  const { target, admin } = await guardNotSelf(formData);
  if (formData.get("deleteProjects") === "on") {
    await sql`DELETE FROM projects WHERE user_id = ${target}`;
  }
  const client = await clerkClient();
  await client.users.deleteUser(target);
  // The Clerk webhook (user.deleted) also cleans up; this covers the case where it isn't configured yet.
  await sql`DELETE FROM members WHERE user_id = ${target}`.catch((e) => console.error("member delete failed", e));
  await audit(admin.id, "delete_member", "member", target);
  refresh();
}
