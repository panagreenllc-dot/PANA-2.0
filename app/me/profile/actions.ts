"use server";

import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/members";
import { parseProfile, type ProfileFormState } from "@/lib/profile-input";
import { getProfileRow, saveProfile, setPublished } from "@/lib/profiles-repo";
import { redirect } from "next/navigation";

async function gated() {
  const v = await getViewer();
  if (v.status === "anon") redirect("/sign-in?redirect_url=/me/profile");
  if (v.status === "needs_welcome") redirect("/welcome?next=/me/profile");
  if (v.status !== "ok" || !v.userId) redirect("/");
  return v.userId;
}

export async function saveProfileAction(_prev: ProfileFormState, fd: FormData): Promise<ProfileFormState> {
  const userId = await gated();
  const { data, state } = parseProfile(fd);
  if (!data) return state!;
  try {
    await saveProfile(userId, data);
  } catch (e) {
    console.error("saveProfile failed", e);
    return { error: "Couldn't save your profile. Please try again." };
  }
  revalidatePath("/me/profile");
  revalidatePath(`/members/${userId}`);
  return { ok: true };
}

export async function togglePublishAction(fd: FormData) {
  const userId = await gated();
  const publish = fd.get("publish") === "true";
  const existing = await getProfileRow(userId);
  if (!existing) redirect("/me/profile?error=save-first");
  await setPublished(userId, publish);
  revalidatePath("/me/profile");
  revalidatePath("/members");
  redirect(`/me/profile?${publish ? "published=1" : "unpublished=1"}`);
}
