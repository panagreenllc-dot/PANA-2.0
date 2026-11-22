import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import OfferForm from "@/components/OfferForm";
import PartnerForm from "@/components/PartnerForm";
import { formatDateTime, formatDay } from "@/lib/datetime";
import { adminCohorts } from "@/lib/incubator-repo";
import { parseUuid } from "@/lib/incubator";
import { CLAIM_METHODS, ELIGIBILITY, label, OFFER_TYPES } from "@/lib/partners";
import { adminPartnerOffers, getPartner, sweep } from "@/lib/partners-repo";
import {
  archiveOfferAction, createOfferAction, partnerStatusAction, pauseOfferAction, publishOfferAction, sendBackOfferAction,
  submitOfferAction, updateOfferAction, updatePartnerAction,
} from "../actions";

const NOTICES: Record<string, string> = {
  created: "Partner added as pending. Approve it when it's ready to show.", converted: "Inquiry converted. Fill in the details, then approve.",
  saved: "Saved.", "status-approved": "Partner approved.", "status-paused": "Partner paused (hidden).", "status-removed": "Partner removed.",
  "status-pending": "Partner set back to pending.", "offer-created": "Offer saved.", "offer-saved": "Offer updated.", "offer-publish": "Offer published.",
  "offer-send_back": "Offer sent back.", "offer-pause": "Offer paused.", "offer-archive": "Offer archived.", "offer-submit": "Offer submitted for approval.",
};
const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold";

export default async function AdminPartnerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string; edit?: string }> }) {
  await requireAdmin();
  const { id: raw } = await params;
  const { error, notice, edit } = await searchParams;
  const id = parseUuid(raw);
  if (!id) notFound();
  await sweep();
  const p = await getPartner(id);
  if (!p) notFound();
  const [offers, cohorts] = await Promise.all([adminPartnerOffers(id), adminCohorts()]);
  const statuses = ["approved", "paused", "pending", "removed"].filter((s) => s !== p.status);
  return (
    <section className="space-y-10">
      <Link href="/admin/partners" className="text-sm text-gray-400 hover:text-white">← Partners</Link>
      <AdminNotice error={error} />
      {notice && NOTICES[notice] && <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200" role="status">{NOTICES[notice]}</p>}
      <div>
        <h2 className="text-2xl font-semibold">{p.name}</h2>
        <p className="text-sm text-gray-400">
          {p.status}{p.approved_at ? ` · approved ${formatDateTime(p.approved_at)}` : ""} · {p.public_listing ? "listed publicly" : "not listed"}
          {p.status === "approved" && p.public_listing && <> · <Link href={`/partners/${p.slug}`} className="underline">public page</Link></>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {statuses.map((s) => (
            <form key={s} action={partnerStatusAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="status" value={s} />
              <button className={`${btn} ${s === "approved" ? "border-green-500/50 bg-green-500 text-black" : s === "removed" ? "border-red-500/40 text-red-300" : "border-white/20"}`}>
                {{ approved: "Approve", paused: "Pause", pending: "Back to pending", removed: "Remove" }[s]}
              </button></form>
          ))}
        </div>
      </div>
      <div>
        <h3 className="mb-3 text-lg font-semibold">Listing details</h3>
        <PartnerForm action={updatePartnerAction} partner={p} submitLabel="Save partner" />
      </div>
      <div>
        <h3 className="mb-3 text-lg font-semibold">Offers ({offers.length})</h3>
        {offers.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-gray-400">No offers yet.</p> : (
          <ul className="space-y-4">
            {offers.map((o) => (
              <li key={o.id} id={`offer-${o.id}`} className="rounded-2xl border border-white/10 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{o.title} <span className="text-sm font-normal text-gray-400">· {label(OFFER_TYPES, o.type)}</span></p>
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{o.status}{o.past_end && o.status !== "expired" ? " (past end date)" : ""}</span>
                </div>
                <p className="text-xs text-gray-500">
                  {label(ELIGIBILITY, o.eligibility)}{o.cohort_name ? ` (${o.cohort_name} only)` : ""} · {label(CLAIM_METHODS, o.claim_method)}
                  {o.schedule_text ? ` · ${o.schedule_text}` : ""}{o.ends_on ? ` · until ${formatDay(o.ends_on)}` : ""}
                </p>
                {o.review_note && <p className="mt-1 text-xs text-yellow-200">Sent back: {o.review_note}</p>}
                <form action={publishOfferAction} className="mt-3 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={o.id} />
                  {o.status === "pending" && <input name="note" maxLength={1000} placeholder="Note when sending back" className="min-w-56 flex-1 rounded-lg border border-white/10 bg-black px-3 py-1.5 text-xs" />}
                  {["draft", "pending", "paused"].includes(o.status) && <button className={`${btn} border-green-500/50 bg-green-500 text-black`}>Publish</button>}
                  {o.status === "pending" && <button formAction={sendBackOfferAction} className={`${btn} border-white/20`}>Send back</button>}
                  {o.status === "draft" && <button formAction={submitOfferAction} className={`${btn} border-white/20`}>Move to queue</button>}
                  {o.status === "published" && <button formAction={pauseOfferAction} className={`${btn} border-white/20`}>Pause</button>}
                  {o.status !== "archived" && <button formAction={archiveOfferAction} className={`${btn} border-red-500/40 text-red-300`}>Archive</button>}
                  {o.status !== "archived" && <Link href={`/admin/partners/${p.id}?edit=${o.id}#offer-${o.id}`} className={`${btn} border-white/20`}>Edit</Link>}
                </form>
                {edit === o.id && o.status !== "archived" && (
                  <div className="mt-4"><OfferForm action={updateOfferAction} partnerId={p.id} offer={o} cohorts={cohorts} submitLabel="Save offer" /></div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <div id="new-offer">
        <h3 className="mb-3 text-lg font-semibold">Add an offer</h3>
        {p.status !== "approved" && <p className="mb-3 text-xs text-yellow-200">This partner isn&apos;t approved yet, so its offers won&apos;t show publicly until you approve it.</p>}
        <OfferForm action={createOfferAction} partnerId={p.id} cohorts={cohorts} submitLabel="Save offer" />
      </div>
    </section>
  );
}
