"use server";

import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { parseTermsUpdate, parseWelcome, safeNext, TERMS_VERSION } from "@/lib/gate";
import { upsertMember, type ClerkUserLike } from "@/lib/members";

export type WelcomeState = { error?: string };

export async function acceptWelcome(_prev: WelcomeState, formData: FormData): Promise<WelcomeState> {
  const { userId } = await auth();
  if (!userId) redirect("/sign-in?redirect_url=/welcome");
  const user = await currentUser();
  if (!user || user.banned) return { error: "Your account can't join right now." };

  if (formData.get("mode") === "update") {
    // Re-acceptance of updated Terms by an existing member: only members who already confirmed their age.
    const parsed = parseTermsUpdate(formData);
    if (!parsed.ok) return { error: parsed.error };
    try {
      const rows = await sql`
        UPDATE members SET terms_accepted_at = now(), terms_version = ${TERMS_VERSION}, updated_at = now()
        WHERE user_id = ${userId} AND status = 'active' AND age_attested_at IS NOT NULL RETURNING user_id`;
      if (!rows.length) return { error: "Please complete the welcome step first." };
    } catch (e) {
      console.error("acceptTermsUpdate failed", e);
      return { error: "Something went wrong saving your confirmation. Please try again." };
    }
    redirect(safeNext(formData.get("next")));
  }

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
