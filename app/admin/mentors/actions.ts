"use server";
// Admin → Mentors & Investors (P3-3): approve / decline / revoke with a note. Every decision is audited.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { isClerkUserId } from "@/lib/clerk-sync";
import { decideRole } from "@/lib/mentors-repo";

export async function decideRoleAction(fd: FormData) {
  const admin = await requireAdmin();
  const role = fd.get("role") === "investor" ? "investor" : "mentor";
  const userId = String(fd.get("userId") ?? "");
  const d = String(fd.get("decision") ?? "");
  const decision = d === "approve" || d === "decline" || d === "revoke" ? d : null;
  const note = String(fd.get("note") ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, "").trim().slice(0, 500) || null;
  if (!isClerkUserId(userId) || !decision) redirect(`/admin/mentors?error=${encodeURIComponent("Invalid decision.")}`);
  if (decision === "revoke" && !note) redirect(`/admin/mentors?error=${encodeURIComponent("Add a short note when removing a badge.")}`);
  const ok = await decideRole(role, userId, decision, admin.id, note);
  if (!ok) redirect(`/admin/mentors?error=${encodeURIComponent("That application was already decided.")}`);
  await audit(admin.id, `${role}_${decision}`, `${role}_profile`, userId, note ?? undefined);
  revalidatePath("/admin", "layout");
  revalidatePath("/mentors");
  revalidatePath(`/members/${userId}`);
  redirect(`/admin/mentors?done=${role}-${decision}`);
}
