import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import PartnerForm from "@/components/PartnerForm";
import { formatDateTime } from "@/lib/datetime";
import { CAN_OFFER, label, OFFER_TYPES, PARTNER_KINDS } from "@/lib/partners";
import { adminInquiries, adminPartners, pendingOffers, sweep } from "@/lib/partners-repo";
import { convertInquiryAction, createPartnerAction, inquiryStatusAction, publishOfferAction, sendBackOfferAction } from "./actions";
import Subnav from "./Subnav";

const NOTICES: Record<string, string> = {
  "inquiry-contacted": "Marked as contacted.", "inquiry-declined": "Inquiry declined.", "inquiry-spam": "Marked as spam.", "inquiry-new": "Moved back to new.",
  "offer-publish": "Offer published.", "offer-send_back": "Offer sent back with your note.",
};
const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold";

export default async function AdminPartnersPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; show?: string }> }) {
  await requireAdmin();
  const { error, notice, show } = await searchParams;
  await sweep();
  const filter = ["converted", "declined", "spam"].includes(show ?? "") ? show! : "open";
  const [inquiries, partners, offers] = await Promise.all([adminInquiries(filter), adminPartners(), pendingOffers()]);
  return (
    <section className="space-y-12">
      <Subnav active="inbox" />
      <AdminNotice error={error} />
      {notice && NOTICES[notice] && <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200" role="status">{NOTICES[notice]}</p>}

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Partner inquiries ({inquiries.length})</h2>
          <div className="flex gap-2 text-xs">
            {["open", "converted", "declined", "spam"].map((f) => (
              <Link key={f} href={f === "open" ? "/admin/partners" : `/admin/partners?show=${f}`} className={`rounded-full px-3 py-1 ${filter === f ? "bg-white text-black" : "border border-white/15 text-gray-300"}`}>{f}</Link>
            ))}
          </div>
        </div>
        <p className="mb-4 text-xs text-gray-500">From the public /support form. Contact details are visible to admins only. Declined and spam inquiries are deleted after 12 months.</p>
        {inquiries.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-gray-400">Nothing here.</p> : (
          <ul className="space-y-4">
            {inquiries.map((i) => (
              <li key={i.id} className="rounded-2xl border border-white/10 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-lg font-semibold">{i.org_name} <span className="text-sm font-normal text-gray-400">· {label(PARTNER_KINDS, i.kind)}</span></p>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{i.status}</span>
                </div>
                <p className="text-sm text-gray-300">{i.contact_name} · <a href={`mailto:${i.contact_email}`} className="underline">{i.contact_email}</a></p>
                <p className="text-xs text-gray-500">Received {formatDateTime(i.created_at)}{i.handled_at ? ` · handled ${formatDateTime(i.handled_at)}` : ""}</p>
                {i.can_offer?.length > 0 && <p className="mt-2 text-sm text-gray-300">Could offer: {i.can_offer.map((c: string) => label(CAN_OFFER, c)).join(", ")}</p>}
                {i.message && <p className="mt-2 whitespace-pre-line text-sm text-gray-300">&ldquo;{i.message}&rdquo;</p>}
                {i.partner_id && <p className="mt-2 text-sm"><Link href={`/admin/partners/${i.partner_id}`} className="text-green-300 underline">Partner: {i.partner_name}</Link></p>}
                {i.admin_note && <p className="mt-2 text-xs text-gray-400">Note: {i.admin_note}</p>}
                {["new", "contacted"].includes(i.status) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={convertInquiryAction}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="org_name" value={i.org_name} />
                      <button className={`${btn} border-green-500/50 bg-green-500 text-black`}>Convert to partner</button></form>
                    {i.status === "new" && <form action={inquiryStatusAction}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="contacted" />
                      <button className={`${btn} border-white/20`}>Mark contacted</button></form>}
                    <form action={inquiryStatusAction}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="declined" />
                      <button className={`${btn} border-white/20 text-gray-300`}>Decline</button></form>
                    <form action={inquiryStatusAction}><input type="hidden" name="id" value={i.id} /><input type="hidden" name="status" value="spam" />
                      <button className={`${btn} border-red-500/40 text-red-300`}>Spam</button></form>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Offers waiting for approval ({offers.length})</h2>
        {offers.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-gray-400">No pending offers.</p> : (
          <ul className="space-y-3">
            {offers.map((o) => (
              <li key={o.id} className="rounded-2xl border border-white/10 p-5">
                <p className="font-semibold">{o.title} <span className="text-sm font-normal text-gray-400">· {label(OFFER_TYPES, o.type)} · <Link href={`/admin/partners/${o.partner_id}#offer-${o.id}`} className="underline">{o.partner_name}</Link>{o.partner_status !== "approved" ? ` (partner ${o.partner_status})` : ""}</span></p>
                <form action={publishOfferAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={o.id} /><input type="hidden" name="back" value="queue" />
                  <input name="note" maxLength={1000} placeholder="Note when sending back (optional)" className="min-w-64 flex-1 rounded-lg border border-white/10 bg-black px-3 py-1.5 text-xs" />
                  <button className={`${btn} border-green-500/50 bg-green-500 text-black`}>Approve &amp; publish</button>
                  <button formAction={sendBackOfferAction} className={`${btn} border-white/20`}>Send back</button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Partners ({partners.length})</h2>
        {partners.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-gray-400">No partners yet. Convert an inquiry or add one below.</p> : (
          <ul className="space-y-3">
            {partners.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-5">
                <div>
                  <Link href={`/admin/partners/${p.id}`} className="text-lg font-semibold hover:text-green-300">{p.name}</Link>
                  <p className="text-xs text-gray-500">{label(PARTNER_KINDS, p.kind)}{p.area ? ` · ${p.area}` : ""} · {p.public_listing ? "listed" : "not listed"}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className={`rounded-full px-2 py-1 ${p.status === "approved" ? "bg-green-500/15 text-green-300" : p.status === "pending" ? "bg-yellow-500/15 text-yellow-200" : "bg-white/10"}`}>{p.status}</span>
                  <span className="rounded-full bg-white/10 px-2 py-1">{p.published} live · {p.pending_offers} pending</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="new-partner">
        <h2 className="mb-4 text-xl font-semibold">Add a partner</h2>
        <p className="mb-3 text-xs text-gray-500">New partners start as pending (hidden). Approve them on their page.</p>
        <PartnerForm action={createPartnerAction} submitLabel="Add partner" />
      </div>
    </section>
  );
}
