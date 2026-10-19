"use server";

import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { getViewer } from "@/lib/members";
import { MAX_PENDING_PER_USER, parseProject, type FormState } from "@/lib/projects";

export async function submitProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId, user, status } = await getViewer();
  if (status === "anon" || !userId) redirect("/sign-in?redirect_url=/submit");
  if (status === "needs_welcome") redirect("/welcome?next=/submit");
  if (status !== "ok" || !user) {
    return { error: "Your account can't submit ideas right now." };
  }

  const { data, state } = parseProject(formData);
  if (!data) return state!;

  const [{ n }] = await sql`
    SELECT count(*)::int AS n FROM projects
    WHERE user_id = ${userId} AND status = 'pending'`;
  if (n >= MAX_PENDING_PER_USER) {
    return {
      error: `You already have ${n} projects awaiting review. Please wait for them to be reviewed.`,
      values: data,
    };
  }

  const name =
    [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "PANA member";
  // D7: the submitter's email is no longer copied into projects (it lives in members, from Clerk).
  await sql`
    INSERT INTO projects (name, project_name, category, description, website, user_id, status)
    VALUES (${name}, ${data.project_name}, ${data.category}, ${data.description},
            ${data.website || null}, ${userId}, 'pending')`;

  redirect("/submit/thanks");
}
