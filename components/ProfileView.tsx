import Link from "next/link";
import { LINK_KINDS, LOOKING_FOR, ROLES } from "@/lib/profile-input";
import type { ProfileView as PV } from "@/lib/visibility";

const label = (list: readonly { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
const chip = "rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-gray-300";

export function ProfileCard({ p }: { p: PV }) {
  return (
    <Link href={`/members/${p.user_id}`} className="block rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-green-400/40">
      <h3 className="font-semibold">{p.display_name}</h3>
      {p.headline && <p className="mt-1 text-sm text-gray-400">{p.headline}</p>}
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.roles.map((r) => <span key={r} className={chip}>{label(ROLES, r)}</span>)}
      </div>
      {p.looking_for.length > 0 && (
        <p className="mt-3 text-xs text-green-400">Looking for: {p.looking_for.map((v) => label(LOOKING_FOR, v)).join(", ")}</p>
      )}
    </Link>
  );
}

export function ProfileDetails({ p }: { p: PV }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">{p.display_name}</h1>
        {p.headline && <p className="mt-2 text-lg text-gray-400">{p.headline}</p>}
      </div>
      {p.roles.length > 0 && <div className="flex flex-wrap gap-2">{p.roles.map((r) => <span key={r} className={chip}>{label(ROLES, r)}</span>)}</div>}
      {p.looking_for.length > 0 && (
        <div><h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-gray-500">Looking for</h2>
          <p>{p.looking_for.map((v) => label(LOOKING_FOR, v)).join(" · ")}</p></div>
      )}
      {p.skills.length > 0 && (
        <div><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Skills</h2>
          <div className="flex flex-wrap gap-1.5">{p.skills.map((s) => <span key={s} className={chip}>{s}</span>)}</div></div>
      )}
      {p.interests.length > 0 && (
        <div><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Interests</h2>
          <div className="flex flex-wrap gap-1.5">{p.interests.map((s) => <span key={s} className={chip}>{s}</span>)}</div></div>
      )}
      {p.experience && (
        <div><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Experience</h2>
          <p className="whitespace-pre-line text-gray-300">{p.experience}</p></div>
      )}
      {Object.keys(p.links ?? {}).length > 0 && (
        <div className="flex flex-wrap gap-4 text-sm">
          {LINK_KINDS.filter((l) => p.links?.[l.key]).map((l) => (
            <a key={l.key} href={p.links![l.key]} target="_blank" rel="noopener noreferrer nofollow ugc" className="text-green-400 underline hover:text-green-300">{l.label}</a>
          ))}
        </div>
      )}
    </div>
  );
}
