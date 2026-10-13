import Link from "next/link";
import { Show, UserButton } from "@clerk/nextjs";
import { getAdmin } from "@/lib/auth";
import sql from "@/lib/db";
import MobileNav from "./MobileNav";

export const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/techcon", label: "Tech Con" },
  { href: "/projects", label: "Projects" },
  { href: "/submit-project", label: "Submit" },
];

async function pendingCount(): Promise<number | null> {
  // Only ever called after the admin check below; re-check defensively.
  if (!(await getAdmin().catch(() => null))) return null;
  try {
    const rows = await sql`SELECT count(*)::int AS n FROM projects WHERE status = 'pending'`;
    return rows[0]?.n ?? 0;
  } catch {
    return null;
  }
}

export default async function Header() {
  const admin = await getAdmin().catch(() => null);
  const pending = admin ? await pendingCount() : null;

  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span className="inline-block h-2.5 w-2.5 rounded-full bg-green-400" />
          PANA 2.0
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-gray-300 md:flex">
          {NAV_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-white">
              {l.label}
            </Link>
          ))}
          {admin && (
            <Link href="/admin" className="font-semibold text-green-400 hover:text-green-300">
              Admin{pending ? ` (${pending})` : ""}
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-3">
          <Show when="signed-out">
            <Link
              href="/sign-in"
              className="hidden text-sm text-gray-300 transition hover:text-white sm:inline"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black transition hover:bg-green-400"
            >
              Join now
            </Link>
          </Show>
          <Show when="signed-in">
            <UserButton />
          </Show>
          <MobileNav links={NAV_LINKS} admin={!!admin} pending={pending ?? 0} />
        </div>
      </div>
    </header>
  );
}
