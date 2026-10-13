import Link from "next/link";
import type { Metadata } from "next";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };

const TABS = [
  { href: "/admin", label: "Pending" },
  { href: "/admin/projects", label: "Listed projects" },
  { href: "/admin/members", label: "Members" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <h1 className="mb-6 text-3xl font-bold tracking-tight">Admin</h1>
      <nav className="mb-8 flex gap-2 border-b border-white/10">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className="-mb-px border-b-2 border-transparent px-4 py-2 text-sm text-gray-300 hover:border-green-400 hover:text-white">
            {t.label}
          </Link>
        ))}
      </nav>
      {children}
    </main>
  );
}
