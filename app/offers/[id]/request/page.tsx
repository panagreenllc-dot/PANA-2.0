import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { audienceLabel, canUseOffer, label, OFFER_TYPES } from "@/lib/partners";
import { participantCohorts } from "@/lib/partners-repo";
import { offerForRequest } from "@/lib/partner-portal-repo";
import { myIdeas } from "@/lib/ideas-repo";
import * as R from "@/lib/requests-repo";
import OfferRequestForm from "@/components/OfferRequestForm";
import { requestOfferAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Request through PANA", robots: { index: false, follow: false } };

export default async function OfferRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { userId } = await requireMember(`/offers/${id}/request`);
  const o = await offerForRequest(id.toLowerCase());
  if (!o || o.claim_method !== "request_via_pana") notFound();
  const cohorts = await participantCohorts(userId);
  const eligible = canUseOffer(o as never, { member: true, participantCohorts: cohorts });
  if (!eligible && !o.open) notFound();
  await R.expireAll();
  const [open, ideas] = await Promise.all([R.hasOpen("offer", o.id, userId), myIdeas(userId)]);
  const isContact = (o.contact_ids as string[]).includes(userId);
  const liveIdeas = ideas.filter((i) => i.status === "approved" && !i.hidden_by_reports).map((i) => ({ id: String(i.id), name: String(i.project_name) }));

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link href={`/partners/${o.partner_slug}`} className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← {o.partner_name}</Link>
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Request through PANA · {label(OFFER_TYPES, o.type)}</p>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">{o.title}</h1>
      <p className="mb-6 text-sm text-gray-400">{o.partner_name} · {audienceLabel(o as never)}{o.schedule_text ? ` · ${o.schedule_text}` : ""}</p>
      {o.how_to && <p className="mb-6 whitespace-pre-line rounded-xl border border-white/10 p-4 text-sm text-gray-300">{o.how_to}</p>}
      {!o.open ? (
        <p className="text-gray-400">This offer isn&apos;t taking requests right now.</p>
      ) : !eligible ? (
        <p className="text-gray-400">This offer is for {o.eligibility === "incubator_participants" ? "accepted incubator participants" : "PANA members"}. <Link href="/incubator" className="text-green-400 underline">About the incubator</Link></p>
      ) : isContact ? (
        <p className="text-gray-400">You&apos;re a contact for {o.partner_name}. Requests for this offer appear in your <Link href="/partner" className="text-green-400 underline">partner portal</Link>.</p>
      ) : open ? (
        <p className="text-gray-300">Your request is sent and waiting for a reply. Track it in <Link href="/me/requests?tab=offer" className="text-green-400 underline">My requests</Link>.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-400">Your email isn&apos;t shared. {o.partner_name} (or the PANA team) reviews your request; if it&apos;s accepted, PANA introduces you both by email. PANA doesn&apos;t give money or equipment; partners provide access directly.</p>
          <OfferRequestForm action={requestOfferAction.bind(null, o.id)} ideas={liveIdeas} />
        </>
      )}
    </main>
  );
}
