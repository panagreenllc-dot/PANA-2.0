import type { Row } from "@/lib/db";
import { PARTNER_KINDS } from "@/lib/partners";

const input = "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white";
const label = "mb-1 block text-xs text-gray-400";

export default function PartnerForm({ action, partner, submitLabel }: { action: (fd: FormData) => Promise<void>; partner?: Row; submitLabel: string }) {
  const p = partner ?? { public_listing: true };
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-white/10 p-6 sm:grid-cols-2">
      {partner && <input type="hidden" name="id" value={partner.id} />}
      <div><label className={label} htmlFor="p_name">Name *</label><input id="p_name" name="name" required maxLength={120} defaultValue={p.name ?? ""} className={input} /></div>
      <div><label className={label} htmlFor="p_slug">Web name (slug)</label><input id="p_slug" name="slug" maxLength={60} defaultValue={p.slug ?? ""} placeholder="made from the name if empty" className={input} /></div>
      <div><label className={label} htmlFor="p_kind">Type</label>
        <select id="p_kind" name="kind" defaultValue={p.kind ?? "college"} className={input}>{PARTNER_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select></div>
      <div><label className={label} htmlFor="p_area">Area</label><input id="p_area" name="area" maxLength={120} defaultValue={p.area ?? ""} placeholder="Fort Pierce, St. Lucie County" className={input} /></div>
      <div className="sm:col-span-2"><label className={label} htmlFor="p_summary">Public summary</label><textarea id="p_summary" name="summary" rows={3} maxLength={1000} defaultValue={p.summary ?? ""} className={input} /></div>
      <div><label className={label} htmlFor="p_website">Website</label><input id="p_website" name="website" type="url" maxLength={300} defaultValue={p.website ?? ""} placeholder="https://" className={input} /></div>
      <label className="flex items-center gap-2 self-end text-sm text-gray-300"><input type="checkbox" name="public_listing" defaultChecked={!!p.public_listing} className="h-4 w-4 accent-green-500" /> Show on the public partners page</label>
      {partner && <div className="sm:col-span-2"><label className={label} htmlFor="p_note">Private admin note</label><textarea id="p_note" name="admin_note" rows={2} maxLength={2000} defaultValue={p.admin_note ?? ""} className={input} /></div>}
      <div className="sm:col-span-2"><button className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400">{submitLabel}</button></div>
    </form>
  );
}
