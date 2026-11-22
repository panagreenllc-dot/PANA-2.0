import Link from "next/link";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { mentorDirectory } from "@/lib/mentors-repo";
import { EXPERTISE, label } from "@/lib/mentors";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentors", robots: { index: false, follow: false } };

export default async function MentorsPage({ searchParams }: { searchParams: Promise<{ expertise?: string }> }) {
  const { expertise } = await searchParams;
  const f = EXPERTISE.some((e) => e.value === expertise) ? expertise! : null;
  await requireMember(`/mentors${f ? `?expertise=${f}` : ""}`, { currentTerms: true });
  const mentors = await mentorDirectory(f);
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? "border-green-500 bg-green-500/15 text-green-200" : "border-white/15 text-gray-300 hover:bg-white/10"}`;

  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Members only</p>
      <h1 className="text-4xl font-bold tracking-tight">Mentors</h1>
      <p className="mt-3 max-w-2xl text-gray-400">
        PANA members who volunteer to mentor, approved by the PANA team. Send a short request; if the mentor accepts, PANA introduces you
        both by email. Email addresses are never shown here. Mentoring is volunteer and unpaid, and PANA doesn&apos;t vet mentors.
      </p>
      <p className="mt-3 text-sm text-gray-400">Want to mentor? <Link href="/me/profile#mentor" className="text-green-400 underline">Apply from your profile</Link>.</p>

      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Filter by expertise">
        <Link href="/mentors" className={chip(!f)} aria-current={!f ? "page" : undefined}>All</Link>
        {EXPERTISE.map((e) => <Link key={e.value} href={`/mentors?expertise=${e.value}`} className={chip(f === e.value)} aria-current={f === e.value ? "page" : undefined}>{e.label}</Link>)}
      </nav>

      {mentors.length === 0 ? (
        <p className="mt-10 rounded-2xl border border-dashed border-white/15 p-12 text-center text-gray-400">
          {f ? "No mentors in this area yet." : "No mentors yet. The first ones are being reviewed."}
        </p>
      ) : (
        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {mentors.map((m) => (
            <Link key={m.user_id} href={`/mentors/${m.user_id}`} className="block rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-green-400/40">
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-semibold">{m.name}</h2>
                <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-300">PANA mentor</span>
              </div>
              {m.headline && <p className="mt-1 text-sm text-gray-400">{m.headline}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">{m.expertise.map((e) => <span key={e} className="rounded-full border border-white/15 px-2.5 py-0.5 text-xs text-gray-300">{label(EXPERTISE, e)}</span>)}</div>
              <p className="mt-3 line-clamp-3 text-sm text-gray-300">{m.bio}</p>
              <p className="mt-3 text-xs text-gray-500">{m.availability ? `${m.availability} · ` : ""}{m.open_load >= m.max_open_mentees ? "Not taking new requests right now" : "Taking requests"}</p>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
