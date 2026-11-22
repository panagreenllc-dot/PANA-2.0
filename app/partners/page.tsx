import Link from "next/link";
import type { Metadata } from "next";
import PageIntro, { btnPrimary } from "@/components/PageIntro";
import type { Row } from "@/lib/db";
import { label, PARTNER_KINDS } from "@/lib/partners";
import { publicPartners } from "@/lib/partners-repo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Community partners",
  description: "Colleges, libraries, businesses and sponsors that give PANA builders access to labs, computers, mentorship, software and space.",
};

export default async function PartnersPage() {
  const partners = await publicPartners().catch(() => [] as Row[]);
  return (
    <main>
      <PageIntro eyebrow="Community partners" title="The people and places backing PANA builders">
        <p>Partners provide access directly: lab and library time, mentorship, software, space and direct sponsorship. PANA connects them with members and incubator participants. Listing a partner isn&apos;t an endorsement.</p>
      </PageIntro>
      <section className="mx-auto max-w-6xl px-6 py-16">
        {partners.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-8 text-gray-400">
            <p className="mb-4">Our first partners are coming soon.</p>
            <Link href="/support" className={btnPrimary + " inline-block"}>Become a partner</Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {partners.map((p) => (
              <Link key={p.id} href={`/partners/${p.slug}`} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-green-500/50">
                <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-400">{label(PARTNER_KINDS, p.kind)}</p>
                <h2 className="text-xl font-semibold">{p.name}</h2>
                {p.area && <p className="mb-2 text-sm text-gray-500">{p.area}</p>}
                {p.summary && <p className="line-clamp-3 text-sm text-gray-400">{p.summary}</p>}
                <p className="mt-3 text-xs text-gray-500">{p.live_offers} current offer{p.live_offers === 1 ? "" : "s"}</p>
              </Link>
            ))}
          </div>
        )}
        <p className="mt-10 text-sm text-gray-400">Want to help? <Link href="/support" className="underline hover:text-white">Become a partner</Link>.</p>
      </section>
    </main>
  );
}
