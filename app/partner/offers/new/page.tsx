import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { myPartners } from "@/lib/partner-portal-repo";
import OfferForm from "@/components/OfferForm";
import { contactCreateOfferAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Add an offer", robots: { index: false, follow: false } };

export default async function NewOfferPage({ searchParams }: { searchParams: Promise<{ p?: string; error?: string }> }) {
  const { userId } = await requireMember("/partner/offers/new");
  const sp = await searchParams;
  const p = (await myPartners(userId)).find((x) => x.id === sp.p);
  if (!p) redirect("/partner");
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Link href={`/partner?p=${p.id}`} className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← Partner portal</Link>
      <h1 className="mb-2 text-3xl font-bold">Add an offer for {p.name}</h1>
      <p className="mb-6 text-gray-400">Describe the access you can give (no money amounts). PANA reviews it before it appears on the site.</p>
      {sp.error && <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{sp.error}</p>}
      <OfferForm action={contactCreateOfferAction} partnerId={p.id} cohorts={[]} submitLabel="Submit for review" hidePublish />
    </main>
  );
}
