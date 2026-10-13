"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sql, { type Row } from "@/lib/db";
import { parseProjectId } from "@/lib/ids";
import { requireAdmin } from "@/lib/auth";
import { parseProject, type FormState } from "@/lib/projects";

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
    UPDATE projects SET status = 'approved', reviewed_at = now(), reviewed_by = ${admin.id}, updated_at = now()
    WHERE id::text = ${id} RETURNING id`, "Project not found (it may already have been removed).");
}

export async function unpublishProject(formData: FormData) {
  const admin = await requireAdmin();
  const id = idOf(formData);
  await run(formData, () => sql`
    UPDATE projects SET status = 'pending', reviewed_at = now(), reviewed_by = ${admin.id}, updated_at = now()
    WHERE id::text = ${id} RETURNING id`, "Project not found (it may already have been removed).");
}

export async function deleteProject(formData: FormData) {
  await requireAdmin();
  const id = idOf(formData);
  await run(formData, () => sql`DELETE FROM projects WHERE id::text = ${id} RETURNING id`,
    "Project not found (it may already have been deleted).");
}

export async function updateProject(rawId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const id = parseProjectId(rawId);
  if (!id) return { error: "Invalid project id." };
  const { data, state } = parseProject(formData);
  if (!data) return state!;
  let rows: Row[];
  try {
    rows = await sql`
      UPDATE projects SET project_name = ${data.project_name}, category = ${data.category},
        description = ${data.description}, website = ${data.website || null}, updated_at = now()
      WHERE id::text = ${id} RETURNING id`;
  } catch (e) {
    console.error("updateProject failed", e);
    return { error: "Database error — please try again.", values: data };
  }
  if (rows.length === 0) return { error: "Project not found.", values: data };
  refresh();
  redirect("/admin/projects");
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
  return target;
}

export async function setAdmin(formData: FormData) {
  const target = await guardNotSelf(formData);
  const makeAdmin = formData.get("makeAdmin") === "true";
  const client = await clerkClient();
  const user = await client.users.getUser(target);
  await client.users.updateUserMetadata(target, {
    publicMetadata: { ...user.publicMetadata, role: makeAdmin ? "admin" : null },
  });
  revalidatePath("/admin/members");
}

export async function setBanned(formData: FormData) {
  const target = await guardNotSelf(formData);
  const client = await clerkClient();
  if (formData.get("ban") === "true") await client.users.banUser(target);
  else await client.users.unbanUser(target);
  revalidatePath("/admin/members");
}

export async function deleteMember(formData: FormData) {
  const target = await guardNotSelf(formData);
  if (formData.get("deleteProjects") === "on") {
    await sql`DELETE FROM projects WHERE user_id = ${target}`;
  }
  const client = await clerkClient();
  await client.users.deleteUser(target);
  refresh();
}
