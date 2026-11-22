import Link from "next/link";
import type { Metadata } from "next";
import OfferCard from "@/components/OfferCard";
import type { Row } from "@/lib/db";
import { canUseOffer, OFFER_TYPES } from "@/lib/partners";
import { allLiveOffers } from "@/lib/partners-repo";
import { offerViewer } from "@/lib/offer-viewer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Incubator resources", description: "Access offers from PANA community partners." };

export default async function ResourcesPage({ searchParams }: { searchParams: Promise<{ type?: string; area?: string }> }) {
  const sp = await searchParams;
  const type = OFFER_TYPES.some((t) => t.value === sp.type) ? sp.type! : "";
  const area = String(sp.area ?? "").trim().slice(0, 60);
  const [all, viewer] = await Promise.all([allLiveOffers().catch(() => [] as Row[]), offerViewer()]);
  const usable = all.filter((o) => canUseOffer(o as never, viewer));
  const areas = [...new Set(usable.map((o) => o.partner_area).filter(Boolean) as string[])].sort();
  const shown = usable.filter((o) => (!type || o.type === type) && (!area || o.partner_area === area));
  const participant = viewer.participantCohorts.length > 0;
  return (
    <main className="mx-auto max-w-5xl px-6 py-16">
      <Link href="/incubator" className="text-sm text-gray-400 hover:text-white">← Incubator</Link>
      <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Incubator resources</p>
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Access from our community partners</h1>
      <p className="mb-6 max-w-2xl text-gray-400">
        {participant ? "These are the offers you can use as an incubator participant. Bring your PANA badge and a photo ID where it says so."
          : viewer.member ? "These are the offers open to you. Accepted incubator participants see more, like reserved lab and library time."
          : "These offers are open to everyone. PANA members and accepted incubator participants see more."}
      </p>
      {participant && <Link href="/me/badge" className="mb-8 inline-block rounded-xl bg-green-500 px-5 py-2 font-semibold text-black hover:bg-green-400">Open my badge</Link>}
      <form className="mb-8 flex flex-wrap items-end gap-3" method="get">
        <label className="text-sm text-gray-300">Type<br />
          <select name="type" defaultValue={type} className="mt-1 rounded-lg border border-white/10 bg-black px-3 py-2">
            <option value="">All types</option>
            {OFFER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="text-sm text-gray-300">Area<br />
          <select name="area" defaultValue={area} className="mt-1 rounded-lg border border-white/10 bg-black px-3 py-2">
            <option value="">All areas</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <button className="rounded-lg border border-white/20 px-4 py-2 text-sm hover:bg-white/10">Filter</button>
      </form>
      {shown.length === 0 ? <p className="text-gray-400">No offers match right now. New partner offers are added as John signs up partners.</p> : (
        <div className="grid gap-6">{shown.map((o) => <OfferCard key={o.id} o={o} canUse showPartner />)}</div>
      )}
      <p className="mt-10 text-sm text-gray-400">Know an organization that could help? <Link href="/support" className="underline hover:text-white">Invite them to become a partner</Link>.</p>
    </main>
  );
}
