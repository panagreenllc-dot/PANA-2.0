import Link from "next/link";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { myPartners } from "@/lib/partner-portal-repo";
import { adminPartnerOffers, sweep } from "@/lib/partners-repo";
import * as R from "@/lib/requests-repo";
import { label, OFFER_TYPES } from "@/lib/partners";
import { formatDate } from "@/lib/datetime";
import ConfirmButton from "@/components/ConfirmButton";
import {
  contactArchiveOfferAction, contactPauseOfferAction, contactResumeOfferAction, contactSubmitOfferAction, proposeListingAction,
} from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Partner portal", robots: { index: false, follow: false } };

const NOTICES: Record<string, string> = {
  "listing-proposed": "Thanks. Your listing changes are waiting for PANA's review; the live listing stays the same until then.",
  "offer-submitted": "Offer submitted. PANA reviews it before it appears on the site.",
  "offer-resubmitted": "Saved. The offer is back in PANA's review queue and hidden until approved.",
  "offer-pause": "Offer paused.", "offer-archive": "Offer archived.", "offer-submit": "Offer submitted for review.",
  "offer-resume": "Offer sent back to review. It goes live again once PANA approves it.",
};
const OFFER_STATUS: Record<string, string> = { draft: "Draft (needs changes)", pending: "In review", published: "Live", paused: "Paused", expired: "Expired", archived: "Archived" };
const REQ_STATUS: Record<string, string> = { pending: "Waiting", accepted: "Accepted", declined: "Declined", withdrawn: "Withdrawn", expired: "Expired" };
const card = "rounded-2xl border border-white/10 p-6";
const inp = "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white";
const btn = "rounded-lg border border-white/20 px-3 py-1.5 text-xs hover:bg-white/10";

export default async function PartnerPortal({ searchParams }: { searchParams: Promise<{ p?: string; notice?: string; error?: string }> }) {
  const { userId } = await requireMember("/partner");
  const sp = await searchParams;
  const partners = await myPartners(userId);
  if (partners.length === 0) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-20">
        <h1 className="mb-4 text-3xl font-bold">Partner portal</h1>
        <p className="text-gray-400">This page is for staff of PANA community partners. Your account isn&apos;t linked to a partner yet. If you work with a partner organization, <Link href="/support#partner-form" className="text-green-400 underline">tell PANA</Link> and we&apos;ll link your account.</p>
      </main>
    );
  }
  const p = partners.find((x) => x.id === sp.p) ?? partners[0];
  await Promise.all([sweep(), R.expireAll()]);
  const [offers, requests, helpOffers] = await Promise.all([adminPartnerOffers(p.id), R.partnerOfferRequests(p.id), R.partnerHelpOffers(p.id)]);
  const pc = p.pending_changes as { name?: string; summary?: string | null; website?: string | null; area?: string | null } | null;
  const v = pc ?? p;
  const hidden = <input type="hidden" name="partner_id" value={p.id} />;

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-20">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Partner portal</p>
        <h1 className="text-4xl font-bold tracking-tight">{p.name}</h1>
        <p className="mt-2 text-gray-400">You&apos;re a {p.role} contact. {p.status === "approved" ? (p.public_listing ? <Link href={`/partners/${p.slug}`} className="text-green-400 underline">View public listing</Link> : "This partner isn't publicly listed.") : `Partner status: ${p.status}.`}</p>
        {partners.length > 1 && (
          <nav className="mt-4 flex flex-wrap gap-2">{partners.map((x) => <Link key={x.id} href={`/partner?p=${x.id}`} className={`rounded-full border px-3 py-1 text-sm ${x.id === p.id ? "border-green-500 text-green-200" : "border-white/15 text-gray-300"}`}>{x.name}</Link>)}</nav>
        )}
      </div>
      {sp.notice && NOTICES[sp.notice] && <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{NOTICES[sp.notice]}</p>}
      {sp.error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{sp.error}</p>}

      <section id="requests" className={card}>
        <h2 className="mb-1 text-xl font-semibold">Requests for your offers</h2>
        <p className="mb-4 text-sm text-gray-400">Members asked to use an offer through PANA. Accepting sends one introduction email to you and the member; until then neither address is shared.</p>
        {requests.length === 0 ? <p className="text-gray-500">No requests yet.</p> : (
          <ul className="divide-y divide-white/10">
            {requests.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <Link href={`/me/requests/offers/${r.id}`} className="hover:text-green-300"><span className="font-medium">{r.subject_title}</span> <span className="text-sm text-gray-400">· {r.requester_name} · {formatDate(r.created_at)}</span></Link>
                <span className="text-xs text-gray-300">{REQ_STATUS[r.status] ?? r.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="offers" className={card}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Offers</h2>
          <Link href={`/partner/offers/new?p=${p.id}`} className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400">Add an offer</Link>
        </div>
        <p className="mb-4 text-sm text-gray-400">Offers describe access (lab hours, mentoring, space, software). New and edited offers are reviewed by PANA before they go live.</p>
        {offers.length === 0 ? <p className="text-gray-500">No offers yet.</p> : (
          <ul className="divide-y divide-white/10">
            {offers.map((o) => (
              <li key={o.id} className="space-y-2 py-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="font-medium">{o.title}</p><p className="text-xs text-gray-500">{label(OFFER_TYPES, o.type)}</p></div>
                  <span className="text-xs text-gray-300">{OFFER_STATUS[o.status] ?? o.status}</span>
                </div>
                {o.review_note && o.status === "draft" && <p className="text-sm text-yellow-200">Note from PANA: {o.review_note}</p>}
                {o.status !== "archived" && (
                  <form className="flex flex-wrap gap-2">
                    {hidden}<input type="hidden" name="id" value={o.id} />
                    <Link href={`/partner/offers/${o.id}`} className={btn}>Edit</Link>
                    {o.status === "published" && <button formAction={contactPauseOfferAction} className={btn}>Pause</button>}
                    {o.status === "paused" && <button formAction={contactResumeOfferAction} className={btn}>Resume (review)</button>}
                    {o.status === "draft" && <button formAction={contactSubmitOfferAction} className={btn}>Submit for review</button>}
                    <button formAction={contactArchiveOfferAction} className={`${btn} text-red-300`}>Archive</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="listing" className={card}>
        <h2 className="mb-1 text-xl font-semibold">Listing</h2>
        <p className="mb-4 text-sm text-gray-400">{pc ? "You have changes waiting for PANA's review (shown below). Saving again replaces them." : "Suggest changes to your public listing. PANA reviews them before they go live."}</p>
        <form action={proposeListingAction} className="grid gap-3 sm:grid-cols-2">
          {hidden}
          <label className="text-sm text-gray-300">Name<input name="name" required minLength={2} maxLength={120} defaultValue={v.name ?? ""} className={`${inp} mt-1`} /></label>
          <label className="text-sm text-gray-300">Area<input name="area" maxLength={120} defaultValue={v.area ?? ""} placeholder="e.g. Fort Pierce" className={`${inp} mt-1`} /></label>
          <label className="text-sm text-gray-300 sm:col-span-2">Website<input name="website" type="url" maxLength={300} defaultValue={v.website ?? ""} placeholder="https://" className={`${inp} mt-1`} /></label>
          <label className="text-sm text-gray-300 sm:col-span-2">Summary<textarea name="summary" rows={4} maxLength={1000} defaultValue={v.summary ?? ""} className={`${inp} mt-1`} /></label>
          <div className="sm:col-span-2"><ConfirmButton message="Send these listing changes to PANA for review?" className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400">Submit changes for review</ConfirmButton></div>
        </form>
      </section>

      <section id="help" className={card}>
        <h2 className="mb-1 text-xl font-semibold">Help offered on behalf of {p.name}</h2>
        <p className="mb-4 text-sm text-gray-400">Offers of help that contacts sent to ideas&apos; needs, choosing &ldquo;on behalf of {p.name}&rdquo;.</p>
        {helpOffers.length === 0 ? <p className="text-gray-500">None yet. Browse <Link href="/ideas?needs=1" className="text-green-400 underline">ideas with open needs</Link>.</p> : (
          <ul className="divide-y divide-white/10">
            {helpOffers.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <span><span className="font-medium">&ldquo;{h.context}&rdquo;</span> <span className="text-sm text-gray-400">on {h.subject_title} · by {h.requester_name} · {formatDate(h.created_at)}</span></span>
                <span className="text-xs text-gray-300">{REQ_STATUS[h.status] ?? h.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p className="text-xs text-gray-500">PANA connects people; it doesn&apos;t give or handle money or equipment. Partners provide access directly.</p>
    </main>
  );
}
