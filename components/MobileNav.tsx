"use client";

import Link from "next/link";
import { useState } from "react";

export default function MobileNav({
  links,
  admin,
  pending,
}: {
  links: { href: string; label: string }[];
  admin: boolean;
  pending: number;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Toggle menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-white/15 px-3 py-2 text-sm"
      >
        {open ? "Close" : "Menu"}
      </button>
      {open && (
        <nav className="absolute inset-x-0 top-full border-b border-white/10 bg-black px-6 py-4">
          <ul className="space-y-3 text-gray-200">
            {links.map((l) => (
              <li key={l.href}>
                <Link href={l.href} onClick={() => setOpen(false)}>
                  {l.label}
                </Link>
              </li>
            ))}
            {admin && (
              <li>
                <Link href="/admin" className="text-green-400" onClick={() => setOpen(false)}>
                  Admin{pending ? ` (${pending})` : ""}
                </Link>
              </li>
            )}
            <li>
              <Link href="/sign-in" onClick={() => setOpen(false)}>
                Sign in
              </Link>
            </li>
          </ul>
        </nav>
      )}
    </div>
  );
}
