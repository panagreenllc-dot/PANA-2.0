import type { Row } from "@/lib/db";
import { CLAIM_METHODS, ELIGIBILITY, OFFER_TYPES, SPONSOR_DIRECT_NOTE } from "@/lib/partners";

const input = "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white";
const label = "mb-1 block text-xs text-gray-400";

/** Offer form (admin and partner portal; partner offers always go to review). Offers describe access; there are no money fields. */
export default function OfferForm({ action, partnerId, offer, cohorts, submitLabel, hidePublish = false }: {
  action: (fd: FormData) => Promise<void>; partnerId: string; offer?: Row; cohorts: Row[]; submitLabel: string; hidePublish?: boolean;
}) {
  const o = offer ?? {};
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-white/10 p-6 sm:grid-cols-2">
      <input type="hidden" name="partner_id" value={partnerId} />
      {offer && <input type="hidden" name="id" value={offer.id} />}
      <div><label className={label}>Type *</label>
        <select name="type" defaultValue={o.type ?? "lab_hours"} className={input}>{OFFER_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
      <div><label className={label}>Title *</label><input name="title" required minLength={3} maxLength={120} defaultValue={o.title ?? ""} placeholder="Fort Pierce campus computer lab" className={input} /></div>
      <div className="sm:col-span-2"><label className={label}>Description</label><textarea name="description" rows={3} maxLength={2000} defaultValue={o.description ?? ""} className={input} />
        <p className="mt-1 text-xs text-gray-500">No money amounts. Sponsor offers automatically say: &ldquo;{SPONSOR_DIRECT_NOTE}&rdquo;</p></div>
      <div><label className={label}>Location name</label><input name="location_name" maxLength={120} defaultValue={o.location_name ?? ""} className={input} /></div>
      <div><label className={label}>Address</label><input name="address" maxLength={200} defaultValue={o.address ?? ""} className={input} /></div>
      <div><label className={label}>Schedule (ET)</label><input name="schedule_text" maxLength={200} defaultValue={o.schedule_text ?? ""} placeholder="Tue/Thu 6 to 9 PM ET" className={input} /></div>
      <div><label className={label}>Availability</label><input name="capacity_text" maxLength={120} defaultValue={o.capacity_text ?? ""} placeholder="8 seats" className={input} /></div>
      <div><label className={label}>Starts on</label><input name="starts_on" type="date" defaultValue={o.starts_on ?? ""} className={input} /></div>
      <div><label className={label}>Ends on (expires after this day, ET)</label><input name="ends_on" type="date" defaultValue={o.ends_on ?? ""} className={input} /></div>
      <div><label className={label}>Who can use it</label>
        <select name="eligibility" defaultValue={o.eligibility ?? "incubator_participants"} className={input}>{ELIGIBILITY.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}</select></div>
      <div><label className={label}>Limit to one cohort (participant offers only)</label>
        <select name="cohort_id" defaultValue={o.cohort_id ?? ""} className={input}><option value="">Any cohort</option>{cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div><label className={label}>How participants use it</label>
        <select name="claim_method" defaultValue={o.claim_method ?? "show_badge"} className={input}>{CLAIM_METHODS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
        <p className="mt-1 text-xs text-gray-500">&ldquo;Request through PANA&rdquo;: members send a short request; the partner&apos;s contacts (or PANA) accept, then PANA introduces them by email.</p></div>
      <div><label className={label}>Partner link (only for &ldquo;Follow the partner&apos;s link&rdquo;)</label><input name="external_url" type="url" maxLength={300} defaultValue={o.external_url ?? ""} placeholder="https://" className={input} /></div>
      <div className="sm:col-span-2"><label className={label}>&ldquo;How to use it&rdquo; instructions</label><textarea name="how_to" rows={2} maxLength={1000} defaultValue={o.how_to ?? ""} placeholder="Show your PANA badge and a photo ID at the front desk, room 112." className={input} /></div>
      {!offer && !hidePublish && <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" name="publish_now" className="h-4 w-4 accent-green-500" /> Publish now (otherwise it waits in the offers queue)</label>}
      <div className="sm:col-span-2"><button className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400">{submitLabel}</button></div>
    </form>
  );
}
