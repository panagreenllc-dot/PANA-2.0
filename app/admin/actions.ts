"use server";

import { clerkClient } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseProject, type FormState } from "@/lib/projects";

function refresh() {
  revalidatePath("/", "layout");
}

function idOf(formData: FormData): number {
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id <= 0) throw new Error("Invalid id");
  return id;
}

// ----- Projects -----

export async function approveProject(formData: FormData) {
  const admin = await requireAdmin();
  await sql`
    UPDATE projects SET status = 'approved', reviewed_at = now(), reviewed_by = ${admin.id}, updated_at = now()
    WHERE id = ${idOf(formData)}`;
  refresh();
}

export async function unpublishProject(formData: FormData) {
  const admin = await requireAdmin();
  await sql`
    UPDATE projects SET status = 'pending', reviewed_at = now(), reviewed_by = ${admin.id}, updated_at = now()
    WHERE id = ${idOf(formData)}`;
  refresh();
}

export async function deleteProject(formData: FormData) {
  await requireAdmin();
  await sql`DELETE FROM projects WHERE id = ${idOf(formData)}`;
  refresh();
}

export async function updateProject(id: number, _prev: FormState, formData: FormData): Promise<FormState> {
  await requireAdmin();
  const { data, state } = parseProject(formData);
  if (!data) return state!;
  await sql`
    UPDATE projects SET project_name = ${data.project_name}, category = ${data.category},
      description = ${data.description}, website = ${data.website || null}, updated_at = now()
    WHERE id = ${id}`;
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
