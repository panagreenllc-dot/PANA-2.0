import Link from "next/link";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import * as R from "@/lib/requests-repo";
import { KIND_INFO, REQUEST_KINDS, isRequestKind, type RequestKind } from "@/lib/requests";
import { formatDate } from "@/lib/datetime";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My requests", robots: { index: false, follow: false } };

const STATUS: Record<string, string> = { pending: "Waiting", accepted: "Accepted", declined: "Declined", withdrawn: "Withdrawn", expired: "Expired" };
const badge = (s: string) => `rounded-full px-2 py-0.5 text-xs ${s === "accepted" ? "bg-green-500/15 text-green-300" : s === "pending" ? "bg-yellow-500/15 text-yellow-200" : "bg-white/10 text-gray-300"}`;

export default async function RequestsPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { userId } = await requireMember("/me/requests");
  const { tab } = await searchParams;
  const kind: RequestKind = isRequestKind(tab) ? tab : "collab";
  await R.expireAll();
  const lists = await Promise.all(REQUEST_KINDS.map((k) => R.listForUser(k, userId)));
  const counts = Object.fromEntries(REQUEST_KINDS.map((k, i) => [k, lists[i].received.filter((r) => r.status === "pending").length]));
  const { received, sent } = lists[REQUEST_KINDS.indexOf(kind)];
  const title = (r: R.RequestRow) => kind === "help" ? `"${r.context}" on ${r.subject_title}` : kind === "mentorship" && r.requester !== userId ? "Mentorship request" : r.subject_title;
  const sections = [
    { h: kind === "help" ? "Offers of help on my needs" : kind === "offer" ? "Requests to my organization" : kind === "mentorship" ? "Requests for my mentorship" : kind === "investor" ? "Investor interest in my ideas" : "Received", rows: received, who: (r: R.RequestRow) => r.requester_name },
    { h: kind === "help" ? "Help I offered" : kind === "offer" ? "Offers I requested" : kind === "mentorship" ? "Mentorship I asked for" : kind === "investor" ? "Ideas I'm interested in" : "Sent", rows: sent, who: (r: R.RequestRow) => kind === "offer" ? r.context ?? "" : r.responder_name ?? "" },
  ];

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-6 py-20">
      <div>
        <Link href="/me" className="mb-4 inline-block text-sm text-gray-400 hover:text-white">← My PANA</Link>
        <h1 className="text-4xl font-bold tracking-tight">My requests</h1>
        <p className="mt-2 text-gray-400">Email addresses are shared only after a request is accepted, in one introduction email.</p>
      </div>
      <nav className="flex flex-wrap gap-2" aria-label="Request types">
        {REQUEST_KINDS.map((k) => (
          <Link key={k} href={`/me/requests?tab=${k}`} aria-current={k === kind ? "page" : undefined}
            className={`rounded-full border px-4 py-1.5 text-sm ${k === kind ? "border-green-500 bg-green-500/15 text-green-200" : "border-white/15 text-gray-300 hover:bg-white/10"}`}>
            {KIND_INFO[k].plural}{counts[k] ? ` (${counts[k]})` : ""}
          </Link>
        ))}
      </nav>
      {sections.map((s) => (
        <section key={s.h} className="rounded-2xl border border-white/10 p-6">
          <h2 className="mb-4 text-xl font-semibold">{s.h}</h2>
          {s.rows.length === 0 ? <p className="text-gray-500">None yet.</p> : (
            <ul className="divide-y divide-white/10">
              {s.rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <Link href={KIND_INFO[kind].path(r.id)} className="hover:text-green-300">
                    <span className="font-medium">{title(r)}</span> <span className="text-sm text-gray-400">· {s.who(r)} · {formatDate(r.created_at)}</span>
                  </Link>
                  <span className={badge(r.status)}>{STATUS[r.status] ?? r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}
