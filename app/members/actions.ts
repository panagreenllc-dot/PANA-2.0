"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getViewer } from "@/lib/members";
import { isClerkUserId } from "@/lib/clerk-sync";
import { parseReport } from "@/lib/profile-input";
import { getProfileRow, reportProfile } from "@/lib/profiles-repo";

export async function reportProfileAction(fd: FormData) {
  const target = String(fd.get("target") ?? "");
  if (!isClerkUserId(target)) redirect("/members");
  const v = await getViewer();
  if (v.status === "anon") redirect(`/sign-in?redirect_url=/members/${target}`);
  if (v.status !== "ok" || !v.userId) redirect(`/welcome?next=/members/${target}`);
  if (v.userId === target) redirect(`/members/${target}?report=self`);
  const parsed = parseReport(fd);
  if (!parsed.ok) redirect(`/members/${target}?report=invalid`);
  if (!(await getProfileRow(target))) redirect("/members");
  const r = await reportProfile(v.userId, target, parsed.reason, parsed.details);
  revalidatePath("/admin/reports");
  redirect(r === "auto_hidden" ? "/members?reported=1" : `/members/${target}?report=${r}`);
}
