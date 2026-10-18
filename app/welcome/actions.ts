"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { parseWelcome, safeNext, TERMS_VERSION } from "@/lib/gate";
import { upsertMember, type ClerkUserLike } from "@/lib/members";

export type WelcomeState = { error?: string };

export async function acceptWelcome(_prev: WelcomeState, formData: FormData): Promise<WelcomeState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/welcome");
  const user = await currentUser();
  if (!user || user.banned) return { error: "Your account can't join right now." };

  const parsed = parseWelcome(formData);
  if (!parsed.ok) return { error: parsed.error };

  try {
    await upsertMember(user as unknown as ClerkUserLike);
    await sql`
      UPDATE members SET age_attested_at = now(), terms_accepted_at = now(), terms_version = ${TERMS_VERSION}, updated_at = now()
      WHERE user_id = ${userId} AND status = 'active'`;
  } catch (e) {
    console.error("acceptWelcome failed", e);
    return { error: "Something went wrong saving your confirmation. Please try again." };
  }
  redirect(safeNext(formData.get("next")));
}
