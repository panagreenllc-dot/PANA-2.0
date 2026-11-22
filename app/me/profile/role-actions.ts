"use server";
// Mentor / investor applications from /me/profile (P3-3). John reviews every one in Admin → Mentors & Investors.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { phase3Ctx } from "@/lib/phase3-gate";
import { parseInvestor, parseMentor } from "@/lib/mentors";
import { pauseMentor, removeRole, saveInvestor, saveMentor } from "@/lib/mentors-repo";

export type RoleFormState = { ok?: boolean; error?: string; notice?: string };

function refresh(userId: string) {
  revalidatePath("/me/profile");
  revalidatePath(`/members/${userId}`);
  revalidatePath("/mentors");
  revalidatePath("/admin", "layout");
}

const SAVED: Record<string, string> = {
  pending: "Saved. The PANA team reviews it; you'll get an email when it's decided.",
  approved: "Saved.",
  paused: "Saved. You're still paused.",
};

export async function saveMentorAction(_prev: RoleFormState, fd: FormData): Promise<RoleFormState> {
  const ctx = await phase3Ctx("/me/profile#mentor");
  const { data, error } = parseMentor(fd);
  if (!data) return { error };
  const status = await saveMentor(ctx.userId, data);
  if (!status) return { error: "PANA removed your mentor badge, so this can't be changed here. Contact PANA if you have questions." };
  refresh(ctx.userId);
  return { ok: true, notice: SAVED[status] ?? "Saved." };
}

export async function saveInvestorAction(_prev: RoleFormState, fd: FormData): Promise<RoleFormState> {
  const ctx = await phase3Ctx("/me/profile#investor");
  const { data, error } = parseInvestor(fd);
  if (!data) return { error };
  const status = await saveInvestor(ctx.userId, data);
  if (!status) return { error: "PANA removed your investor badge, so this can't be changed here. Contact PANA if you have questions." };
  refresh(ctx.userId);
  return { ok: true, notice: SAVED[status] ?? "Saved." };
}

export async function pauseMentorAction(fd: FormData) {
  const ctx = await phase3Ctx("/me/profile#mentor");
  const to = fd.get("to") === "resume" ? "resume" : "pause";
  await pauseMentor(ctx.userId, to);
  refresh(ctx.userId);
  redirect(`/me/profile?role=${to === "pause" ? "paused" : "resumed"}#mentor`);
}

export async function removeRoleAction(fd: FormData) {
  const role = fd.get("role") === "investor" ? "investor" : "mentor";
  const ctx = await phase3Ctx(`/me/profile#${role}`);
  await removeRole(role, ctx.userId);
  refresh(ctx.userId);
  redirect(`/me/profile?role=removed-${role}#${role}`);
}
