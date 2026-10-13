"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { MAX_PENDING_PER_USER, parseProject, type FormState } from "@/lib/projects";

export async function submitProject(_prev: FormState, formData: FormData): Promise<FormState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/submit-project");

  const user = await currentUser();
  if (!user || user.banned) {
    return { error: "Your account can't submit projects right now." };
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
  const email = user.primaryEmailAddress?.emailAddress ?? "";

  await sql`
    INSERT INTO projects (name, email, project_name, category, description, website, user_id, status)
    VALUES (${name}, ${email}, ${data.project_name}, ${data.category}, ${data.description},
            ${data.website || null}, ${userId}, 'pending')`;

  redirect("/submit-project/thanks");
}
