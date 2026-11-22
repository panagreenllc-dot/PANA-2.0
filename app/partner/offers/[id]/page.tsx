import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { contactRole } from "@/lib/partner-portal-repo";
import { getOffer } from "@/lib/partners-repo";
import OfferForm from "@/components/OfferForm";
import { contactUpdateOfferAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit offer", robots: { index: false, follow: false } };

export default async function EditOfferPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { userId } = await requireMember(`/partner/offers/${id}`);
  const o = await getOffer(id.toLowerCase());
  if (!o || o.status === "archived" || !(await contactRole(String(o.partner_id), userId))) notFound();
  const { error } = await searchParams;
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Link href={`/partner?p=${o.partner_id}`} className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← Partner portal</Link>
      <h1 className="mb-2 text-3xl font-bold">Edit offer</h1>
      <p className="mb-6 text-gray-400">Saving sends the offer back to PANA&apos;s review; it&apos;s hidden until approved.</p>
      {o.review_note && <p className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">Note from PANA: {o.review_note}</p>}
      {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{error}</p>}
      <OfferForm action={contactUpdateOfferAction} partnerId={String(o.partner_id)} offer={o} cohorts={[]} submitLabel="Save and send for review" hidePublish />
    </main>
  );
}
