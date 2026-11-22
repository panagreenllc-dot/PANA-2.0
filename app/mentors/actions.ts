"use server";
// "Request mentorship" (P3-3). Every check is repeated in SQL (MENTORSHIP_INSERT_SQL); these give friendly errors.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isClerkUserId } from "@/lib/clerk-sync";
import { phase3Ctx } from "@/lib/phase3-gate";
import { canSend, parseRequestMessage, SEND_ERRORS } from "@/lib/requests";
import { MENTORSHIP_PER_DAY } from "@/lib/mentors";
import { isGatedMember } from "@/lib/visibility";
import { mentorOne, reportRole } from "@/lib/mentors-repo";
import { parseReport } from "@/lib/profile-input";
import * as R from "@/lib/requests-repo";

export type MentorshipState = { ok?: boolean; error?: string };

export async function requestMentorshipAction(mentorId: string, _prev: MentorshipState, fd: FormData): Promise<MentorshipState> {
  if (!isClerkUserId(mentorId)) return { error: "Mentor not found." };
  const ctx = await phase3Ctx(`/mentors/${mentorId}`);
  const parsed = parseRequestMessage(fd, "mentorship");
  if (!parsed.ok) return { error: parsed.error };
  const m = await mentorOne(mentorId);
  const projectId = String(fd.get("project_id") ?? "");
  await R.expireAll();
  const check = canSend({
    viewerGated: isGatedMember(ctx), viewerId: ctx.userId, responderIds: [mentorId],
    targetOpen: !!m && m.status === "approved" && m.member_status === "active" && m.moderation === "ok" && m.open_load < m.max_open_mentees,
    sentLast24h: await R.sentLastDayAll(ctx.userId), hasOpenRequest: await R.hasOpen("mentorship", mentorId, ctx.userId),
    kindSentLast24h: await R.sentLastDayKind("mentorship", ctx.userId), kindLimit: MENTORSHIP_PER_DAY,
  });
  if (!check.ok) return { error: check.reason === "not_visible" ? "This mentor isn't taking new requests right now." : SEND_ERRORS[check.reason] };
  const id = await R.createMentorshipRequest(mentorId, ctx.userId, parsed.message, /^[0-9a-f-]{36}$/i.test(projectId) ? projectId.toLowerCase() : null);
  if (!id) return { error: "This mentor isn't taking new requests right now." };
  await R.notifyResponder("mentorship", id);
  revalidatePath(`/mentors/${mentorId}`);
  revalidatePath("/me");
  return { ok: true };
}

export async function reportMentorAction(fd: FormData) {
  const target = String(fd.get("target") ?? "");
  if (!isClerkUserId(target)) redirect("/mentors");
  const ctx = await phase3Ctx(`/mentors/${target}`);
  const p = parseReport(fd);
  if (!p.ok) redirect(`/mentors/${target}?report=invalid`);
  if (target === ctx.userId) redirect(`/mentors/${target}?report=self`);
  const ok = await reportRole(ctx.userId, "mentor_profile", target, p.reason, p.details || null);
  revalidatePath("/admin/reports");
  redirect(`/mentors/${target}?report=${ok ? "reported" : "duplicate"}`);
}
