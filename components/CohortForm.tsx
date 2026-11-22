import { toEasternLocalInput } from "@/lib/datetime";
import { COHORT_FORMATS, COHORT_STATUSES } from "@/lib/incubator";
import type { Row } from "@/lib/db";

const input = "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white";
const label = "mb-1 block text-xs text-gray-400";

/** Admin cohort form. Date-times are entered and shown in Eastern Time (ET). */
export default function CohortForm({ action, cohort, submitLabel }: { action: (fd: FormData) => Promise<void>; cohort?: Row; submitLabel: string }) {
  const c = cohort ?? {};
  return (
    <form action={action} className="grid gap-4 rounded-2xl border border-white/10 p-6 sm:grid-cols-2">
      {cohort && <input type="hidden" name="id" value={cohort.id} />}
      <div><label className={label} htmlFor="name">Name *</label><input id="name" name="name" required maxLength={80} defaultValue={c.name ?? ""} placeholder="Cohort 1, Spring 2027" className={input} /></div>
      <div><label className={label} htmlFor="slug">Web name (slug)</label><input id="slug" name="slug" maxLength={60} defaultValue={c.slug ?? ""} placeholder="made from the name if empty" className={input} /></div>
      <div className="sm:col-span-2"><label className={label} htmlFor="summary">Summary (public)</label><textarea id="summary" name="summary" maxLength={1000} rows={3} defaultValue={c.summary ?? ""} className={input} /></div>
      <div><label className={label} htmlFor="format">Format</label>
        <select id="format" name="format" defaultValue={c.format ?? "virtual"} className={input}>{COHORT_FORMATS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}</select></div>
      <div><label className={label} htmlFor="capacity">Spots *</label><input id="capacity" name="capacity" type="number" min={1} max={500} required defaultValue={c.capacity ?? 10} className={input} /></div>
      <div><label className={label} htmlFor="apply_opens_at">Applications open (ET)</label><input id="apply_opens_at" name="apply_opens_at" type="datetime-local" defaultValue={toEasternLocalInput(c.apply_opens_at)} className={input} /></div>
      <div><label className={label} htmlFor="apply_closes_at">Applications close (ET) *needed to open</label><input id="apply_closes_at" name="apply_closes_at" type="datetime-local" defaultValue={toEasternLocalInput(c.apply_closes_at)} className={input} /></div>
      <div><label className={label} htmlFor="starts_on">Program starts</label><input id="starts_on" name="starts_on" type="date" defaultValue={c.starts_on ?? ""} className={input} /></div>
      <div><label className={label} htmlFor="ends_on">Program ends</label><input id="ends_on" name="ends_on" type="date" defaultValue={c.ends_on ?? ""} className={input} /></div>
      <div><label className={label} htmlFor="announce_on">Decisions announced on</label><input id="announce_on" name="announce_on" type="date" defaultValue={c.announce_on ?? ""} className={input} /></div>
      <div><label className={label} htmlFor="announce_note">Announcement note (public)</label><input id="announce_note" name="announce_note" maxLength={200} defaultValue={c.announce_note ?? ""} placeholder="Accepted participants announced at Treasure Coast Tech Con" className={input} /></div>
      <div><label className={label} htmlFor="status">Status</label>
        <select id="status" name="status" defaultValue={c.status ?? "draft"} className={input}>{COHORT_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      <div className="flex items-end"><button className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400">{submitLabel}</button></div>
      <p className="text-xs text-gray-500 sm:col-span-2">All times are Eastern Time (ET). Draft cohorts are hidden from the public. &quot;Open&quot; accepts applications only between the open and close times.</p>
    </form>
  );
}
