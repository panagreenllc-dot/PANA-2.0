import { auth, currentUser, type User } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import sql, { type Row } from "@/lib/db";
import { gateStatus, type GateStatus, type MemberRecord } from "@/lib/gate";
import { memberFieldsFromClerk, type ClerkUserLike } from "@/lib/clerk-sync";

export type { ClerkUserLike };

/** Insert or refresh the member row from Clerk data. Never touches the attestation columns. */
export async function upsertMember(u: ClerkUserLike): Promise<void> {
  const f = memberFieldsFromClerk(u);
  await sql`
    INSERT INTO members (user_id, email, email_verified, display_name, image_url, status)
    VALUES (${f.user_id}, ${f.email}, ${f.email_verified}, ${f.display_name}, ${f.image_url}, ${f.status})
    ON CONFLICT (user_id) DO UPDATE SET
      email = EXCLUDED.email, email_verified = EXCLUDED.email_verified,
      display_name = EXCLUDED.display_name, image_url = EXCLUDED.image_url,
      status = CASE WHEN members.status = 'deleted' THEN members.status ELSE EXCLUDED.status END,
      updated_at = now()`;
}

export async function getMemberRecord(userId: string): Promise<Row | null> {
  const rows = await sql`
    SELECT user_id, age_attested_at, terms_accepted_at, terms_version, status FROM members WHERE user_id = ${userId}`;
  return rows[0] ?? null;
}

export type Viewer = { userId: string | null; user: User | null; status: GateStatus };

/** Who is looking? Also performs the fallback Clerk → DB sync if the webhook hasn't run yet. */
export async function getViewer(): Promise<Viewer> {
  const { userId } = await auth();
  if (!userId) return { userId: null, user: null, status: "anon" };
  const user = await currentUser();
  let member = await getMemberRecord(userId);
  if (!member && user) {
    await upsertMember(user as unknown as ClerkUserLike);
    member = await getMemberRecord(userId);
  }
  return { userId, user, status: gateStatus({ userId, banned: user?.banned, member: member as MemberRecord }) };
}

/** For member-only pages and server actions. Redirects anyone who hasn't completed the gate. */
export async function requireMember(next: string): Promise<Viewer & { userId: string; user: User }> {
  const v = await getViewer();
  if (v.status === "anon") redirect(`/sign-in?redirect_url=${encodeURIComponent(next)}`);
  if (v.status === "needs_welcome") redirect(`/welcome?next=${encodeURIComponent(next)}`);
  if (v.status === "banned" || !v.user) redirect("/?error=account");
  return v as Viewer & { userId: string; user: User };
}
