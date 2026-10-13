import { auth, currentUser, type User } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

function adminEmails(): string[] {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  if ((user.publicMetadata as { role?: string })?.role === "admin") return true;
  const allow = adminEmails();
  if (allow.length === 0) return false;
  return user.emailAddresses.some((e) =>
    allow.includes(e.emailAddress.toLowerCase()),
  );
}

/** Returns the current user if they are an admin, otherwise null. */
export async function getAdmin(): Promise<User | null> {
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  return isAdminUser(user) ? user : null;
}

/** Use in admin pages and server actions. Non-admins get a 404. */
export async function requireAdmin(): Promise<User> {
  const user = await getAdmin();
  if (!user) notFound();
  return user;
}
