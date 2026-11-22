import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import OfferCard from "@/components/OfferCard";
import { canUseOffer, label, PARTNER_KINDS } from "@/lib/partners";
import { partnerLiveOffers, publicPartner } from "@/lib/partners-repo";
import { offerViewer } from "@/lib/offer-viewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = await publicPartner(slug).catch(() => null);
  return p ? { title: `${p.name} · Partner`, description: p.summary?.slice(0, 160) ?? undefined } : { title: "Partner" };
}

export default async function PartnerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{1,60}$/.test(slug)) notFound();
  const p = await publicPartner(slug);
  if (!p) notFound();
  const [offers, viewer] = await Promise.all([partnerLiveOffers(p.id), offerViewer()]);
  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <Link href="/partners" className="text-sm text-gray-400 hover:text-white">← All partners</Link>
      <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">{label(PARTNER_KINDS, p.kind)}</p>
      <h1 className="mb-2 text-4xl font-bold tracking-tight">{p.name}</h1>
      {p.area && <p className="mb-4 text-gray-400">{p.area}</p>}
      {p.summary && <p className="mb-4 max-w-2xl whitespace-pre-line text-gray-300">{p.summary}</p>}
      {p.website && <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="text-sm text-green-300 underline">Website ↗</a>}
      <h2 className="mb-4 mt-12 text-2xl font-semibold">Current offers</h2>
      {offers.length === 0 ? <p className="text-gray-400">No current offers.</p> : (
        <div className="grid gap-6">
          {offers.map((o) => <OfferCard key={o.id} o={o} canUse={canUseOffer(o as never, viewer)} />)}
        </div>
      )}
      <p className="mt-10 text-xs text-gray-500">Partners provide these resources directly, under their own rules. PANA only connects people and doesn&apos;t handle money.</p>
    </main>
  );
}
