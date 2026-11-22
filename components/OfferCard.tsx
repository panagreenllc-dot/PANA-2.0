import Link from "next/link";
import type { Row } from "@/lib/db";
import { formatDay } from "@/lib/datetime";
import { audienceLabel, howToUse, label, OFFER_TYPES } from "@/lib/partners";

/** An offer as shown to the public. Full details only when `canUse`; otherwise only who it's for. */
export default function OfferCard({ o, canUse, showPartner = false }: { o: Row; canUse: boolean; showPartner?: boolean }) {
  const how = howToUse(o as never);
  return (
    <article className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
      <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-400">{label(OFFER_TYPES, o.type)}</p>
      <h3 className="text-lg font-semibold">{o.title}</h3>
      {showPartner && (
        <p className="mb-2 text-sm text-gray-400">
          {o.partner_listed === false ? o.partner_name : <Link href={`/partners/${o.partner_slug}`} className="underline hover:text-white">{o.partner_name}</Link>}
          {o.partner_area ? ` · ${o.partner_area}` : ""}
        </p>
      )}
      <p className="mb-3 text-xs text-gray-500">{audienceLabel(o as never)}</p>
      {canUse ? (
        <div className="space-y-3 text-sm text-gray-300">
          {o.description && <p className="whitespace-pre-line">{o.description}</p>}
          <dl className="grid gap-2 sm:grid-cols-2">
            {o.location_name && <div><dt className="text-gray-500">Where</dt><dd>{o.location_name}{o.address ? `, ${o.address}` : ""}</dd></div>}
            {o.schedule_text && <div><dt className="text-gray-500">When</dt><dd>{o.schedule_text}</dd></div>}
            {(o.starts_on || o.ends_on) && <div><dt className="text-gray-500">Dates</dt><dd>{o.starts_on ? formatDay(o.starts_on) : "Now"}{o.ends_on ? ` – ${formatDay(o.ends_on)}` : ""}</dd></div>}
            {o.capacity_text && <div><dt className="text-gray-500">Availability</dt><dd>{o.capacity_text}</dd></div>}
          </dl>
          <div className="rounded-xl border border-green-500/30 bg-green-500/5 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-green-300">How to use it</p>
            <p className="whitespace-pre-line">{how.text}</p>
            {how.kind === "link" && how.href && <a href={how.href} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block font-semibold text-green-300 underline">Open the partner&apos;s page ↗</a>}
            {how.kind === "request" && <Link href={`/offers/${o.id}/request`} className="mt-2 inline-block rounded-lg bg-green-500 px-4 py-2 font-semibold text-black hover:bg-green-400">Request through PANA</Link>}
            {how.kind === "badge" && <Link href="/me/badge" className="mt-2 inline-block font-semibold text-green-300 underline">Open my badge</Link>}
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-400">
          {o.eligibility === "members" ? "Sign in as a PANA member to see the details." : <>Details are shown to accepted incubator participants. <Link href="/incubator" className="underline hover:text-white">About the incubator</Link></>}
        </p>
      )}
    </article>
  );
}
