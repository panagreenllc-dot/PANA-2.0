"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/members";
import { mergePrefs, submitApplication, acceptingCohort, hasLiveApplication, withdrawApplication } from "@/lib/incubator-repo";
import { parseApplication, parseUuid, type ApplicationFormState } from "@/lib/incubator";

export async function notifyMeAction(fd: FormData) {
  const { userId } = await requireMember("/incubator");
  const on = fd.get("on") === "on";
  await mergePrefs(userId, { incubator_news: on });
  revalidatePath("/incubator");
  redirect(`/incubator?notice=${on ? "notify-on" : "notify-off"}#notify`);
}

export async function applyAction(_prev: ApplicationFormState, fd: FormData): Promise<ApplicationFormState> {
  // Phase 3 feature: requires the current Terms version (older acceptances are sent to re-accept first).
  const { userId } = await requireMember("/incubator/apply", { currentTerms: true });
  const { data, state } = parseApplication(fd);
  if (!data) return state!;
  try {
    const cohort = await acceptingCohort(data.cohort_id);
    if (!cohort) return { error: "The incubator isn't accepting applications right now.", values: { ...data, link: data.links.main ?? "" } };
    if (await hasLiveApplication(data.cohort_id, userId)) {
      return { error: "You already have an application. You can see it on My PANA.", values: { ...data, link: data.links.main ?? "" } };
    }
    const id = await submitApplication(userId, data);
    if (!id) return { error: "We couldn't submit this application. Check that the idea is yours and still active.", values: { ...data, link: data.links.main ?? "" } };
  } catch (e) {
    console.error("applyAction failed", e);
    return { error: "Something went wrong. Please try again.", values: { ...data, link: data.links.main ?? "" } };
  }
  revalidatePath("/me");
  redirect("/me?saved=applied#incubator");
}

export async function withdrawApplicationAction(fd: FormData) {
  const { userId } = await requireMember("/me");
  const id = parseUuid(fd.get("id"));
  if (id) await withdrawApplication(id, userId);
  revalidatePath("/me");
  redirect("/me?saved=withdrawn#incubator");
}
