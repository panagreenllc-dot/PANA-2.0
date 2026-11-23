// Admin form for announcements and events (P3-4). Times are typed in Eastern Time. Server component (plain form post).
import { DEFAULT_REG_NOTE, FEED_LIMITS, agendaToLines, speakersToLines } from "@/lib/community";
import type { FeedPost } from "@/lib/community-repo";
import { toEasternLocalInput } from "@/lib/datetime";

const inp = "mt-1 w-full rounded-xl border border-white/10 bg-black px-4 py-2.5 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none";
const lbl = "block text-sm text-gray-300";

export default function FeedPostForm({ action, post, agenda = [], speakers = [], submit }: {
  action: (fd: FormData) => Promise<void>; post?: FeedPost | null; agenda?: { time_label: string; title: string }[];
  speakers?: { name: string; role: string }[]; submit: string;
}) {
  const p = post;
  return (
    <form action={action} className="space-y-5">
      {p && <input type="hidden" name="id" value={p.id} />}
      <div className="grid gap-4 sm:grid-cols-3">
        <label className={lbl}>Type
          <select name="kind" defaultValue={p?.kind ?? "announcement"} className={inp}>
            <option value="announcement">Announcement</option><option value="event">Event</option>
          </select>
        </label>
        <label className={lbl}>Program
          <select name="program" defaultValue={p?.program ?? "community"} className={inp}>
            <option value="community">Community</option><option value="incubator">Incubator</option><option value="techcon">Tech Con</option>
          </select>
        </label>
        <label className={lbl}>Who can see it
          <select name="audience" defaultValue={p?.audience ?? "public"} className={inp}>
            <option value="public">Everyone</option><option value="members">Members only</option>
          </select>
        </label>
      </div>
      <label className={lbl}>Title
        <input name="title" required minLength={FEED_LIMITS.title[0]} maxLength={FEED_LIMITS.title[1]} defaultValue={p?.title ?? ""} className={inp} />
      </label>
      <label className={lbl}>Web address <span className="text-gray-500">(optional; made from the title if blank, e.g. spring-meetup)</span>
        <input name="slug" maxLength={80} defaultValue={p?.slug ?? ""} className={inp} />
      </label>
      <label className={lbl}>Text
        <textarea name="body" maxLength={FEED_LIMITS.body} rows={6} defaultValue={p?.body ?? ""} className={inp} />
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-300"><input type="checkbox" name="pinned" defaultChecked={p?.pinned ?? false} className="accent-green-500" /> Pin to the top</label>

      <fieldset className="space-y-4 rounded-2xl border border-white/10 p-5">
        <legend className="px-2 text-sm font-semibold text-gray-200">Event details (events only, Eastern Time)</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={lbl}>Starts (ET)<input type="datetime-local" name="starts_at" defaultValue={toEasternLocalInput(p?.starts_at)} className={inp} /></label>
          <label className={lbl}>Ends (ET)<input type="datetime-local" name="ends_at" defaultValue={toEasternLocalInput(p?.ends_at)} className={inp} /></label>
          <label className={lbl}>Venue<input name="location_name" maxLength={FEED_LIMITS.location} defaultValue={p?.location_name ?? ""} className={inp} /></label>
          <label className={lbl}>Address<input name="address" maxLength={FEED_LIMITS.address} defaultValue={p?.address ?? ""} className={inp} /></label>
          <label className={lbl}>Price <span className="text-gray-500">(e.g. To be announced, Free, $10)</span><input name="price_text" maxLength={FEED_LIMITS.price} defaultValue={p?.price_text ?? ""} className={inp} /></label>
          <label className="flex items-center gap-2 self-end pb-3 text-sm text-gray-300"><input type="checkbox" name="is_online" defaultChecked={p?.is_online ?? false} className="accent-green-500" /> Online event</label>
          <label className={lbl}>Registration link <span className="text-gray-500">(leave blank until it&apos;s ready)</span><input type="url" name="registration_url" maxLength={FEED_LIMITS.url} placeholder="https://" defaultValue={p?.registration_url ?? ""} className={inp} /></label>
          <label className={lbl}>Shown when there&apos;s no link<input name="registration_note" maxLength={FEED_LIMITS.regNote} defaultValue={p?.registration_note ?? DEFAULT_REG_NOTE} className={inp} /></label>
        </div>
        <label className={lbl}>Agenda <span className="text-gray-500">(one per line: time | item, e.g. 10:30 AM | Doors open)</span>
          <textarea name="agenda" rows={5} defaultValue={agendaToLines(agenda)} className={inp} />
        </label>
        <label className={lbl}>Speakers <span className="text-gray-500">(one per line: name | role)</span>
          <textarea name="speakers" rows={3} defaultValue={speakersToLines(speakers)} className={inp} />
        </label>
      </fieldset>
      <button className="rounded-xl bg-green-500 px-6 py-3 font-semibold text-black hover:bg-green-400">{submit}</button>
    </form>
  );
}
