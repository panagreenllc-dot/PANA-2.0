// One event's key facts (P3-4): date and time in ET, venue with a Maps link, price, registration and "Add to calendar".
import { formatEventRange } from "@/lib/datetime";
import { DEFAULT_REG_NOTE, mapsUrl } from "@/lib/community";
import type { FeedPost } from "@/lib/community-repo";

export default function EventDetails({ e, calendarHref, extra }: { e: FeedPost; calendarHref: string; extra?: React.ReactNode }) {
  const when = formatEventRange(e.starts_at, e.ends_at);
  return (
    <>
      <dl className="mb-10 grid max-w-4xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-l border-green-400/50 pl-4">
          <dt className="text-xs uppercase tracking-wider text-gray-500">Date</dt>
          <dd className="mt-1 font-medium">{when.day}</dd>
        </div>
        <div className="border-l border-green-400/50 pl-4">
          <dt className="text-xs uppercase tracking-wider text-gray-500">Time</dt>
          <dd className="mt-1 font-medium">{when.time}</dd>
        </div>
        <div className="border-l border-green-400/50 pl-4">
          <dt className="text-xs uppercase tracking-wider text-gray-500">{e.is_online ? "Where" : "Venue"}</dt>
          <dd className="mt-1 font-medium">
            {e.is_online && !e.location_name ? "Online" : e.location_name || e.address ? (
              <a href={mapsUrl(e.location_name, e.address)} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-4 hover:text-green-300">
                {e.location_name ?? e.address}
              </a>
            ) : "To be announced"}
            {e.address && e.location_name && <span className="mt-1 block text-sm font-normal text-gray-400">{e.address}</span>}
          </dd>
        </div>
        <div className="border-l border-green-400/50 pl-4">
          <dt className="text-xs uppercase tracking-wider text-gray-500">Price</dt>
          <dd className="mt-1 font-medium">{e.price_text || "To be announced"}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-3 sm:flex-row">
        {e.registration_url ? (
          <a href={e.registration_url} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-green-500 px-6 py-3 text-center font-semibold text-black transition hover:bg-green-400">
            Register
          </a>
        ) : (
          <span className="cursor-not-allowed rounded-xl bg-green-500/40 px-6 py-3 text-center font-semibold text-black/70">
            {e.registration_note || DEFAULT_REG_NOTE}
          </span>
        )}
        <a href={calendarHref} className="rounded-xl border border-white/20 px-6 py-3 text-center font-semibold transition hover:bg-white hover:text-black">Add to calendar</a>
        {extra}
      </div>
    </>
  );
}
