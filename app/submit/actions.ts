"use server";

import { redirect } from "next/navigation";
import { getViewer } from "@/lib/members";
import { MAX_PENDING_PER_USER, parseIdea, type IdeaFormState } from "@/lib/ideas";
import { countPending, createIdea } from "@/lib/ideas-repo";

export async function submitProject(_prev: IdeaFormState, formData: FormData): Promise<IdeaFormState> {
  const { userId, user, status } = await getViewer();
  if (status === "anon" || !userId) redirect("/sign-in?redirect_url=/submit");
  if (status === "needs_welcome") redirect("/welcome?next=/submit");
  if (status !== "ok" || !user) return { error: "Your account can't submit ideas right now." };

  const { data, state } = parseIdea(formData);
  if (!data) return state!;

  const n = await countPending(userId);
  if (n >= MAX_PENDING_PER_USER) {
    return { error: `You already have ${n} ideas awaiting review. Please wait for them to be reviewed.`, values: data };
  }
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "PANA member";
  await createIdea(userId, name, data); // D7: no email copied into the idea
  redirect("/submit/thanks");
}
