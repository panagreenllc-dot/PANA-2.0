import Link from "next/link";
import type { Metadata } from "next";
import sql from "@/lib/db";
import { requireMember } from "@/lib/members";
import { expireStale, listRequests, myIdeas } from "@/lib/ideas-repo";
import { getProfileRow } from "@/lib/profiles-repo";
import { emailPrefsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My PANA", robots: { index: false, follow: false } };

const STATUS: Record<string, string> = {
  pending: "In review", approved: "Live", rejected: "Not approved", withdrawn: "Withdrawn", changes_requested: "Changes requested",
  accepted: "Accepted", declined: "Declined", expired: "Expired",
};
const badge = (s: string) =>
  `rounded-full px-2 py-0.5 text-xs ${s === "approved" || s === "accepted" ? "bg-green-500/15 text-green-300" : s === "pending" ? "bg-yellow-500/15 text-yellow-200" : "bg-white/10 text-gray-300"}`;

export default async function MePage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const { userId } = await requireMember("/me");
  const { saved } = await searchParams;
  await expireStale();
  const [ideas, { received, sent }, profile, [m]] = await Promise.all([
    myIdeas(userId), listRequests(userId), getProfileRow(userId),
    sql`SELECT email_prefs FROM members WHERE user_id = ${userId}`,
  ]);
  const prefs = (m?.email_prefs ?? {}) as { requests?: boolean; reviews?: boolean };
  const card = "rounded-2xl border border-white/10 p-6";

  return (
    <main className="mx-auto max-w-4xl space-y-10 px-6 py-20">
      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">My PANA</p>
        <h1 className="text-4xl font-bold tracking-tight">Your ideas, requests and profile</h1>
      </div>

      <section className={card}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold">Profile</h2>
            <p className="text-sm text-gray-400">{!profile ? "Not created yet" : profile.moderation === "hidden" ? "Hidden by moderators" : profile.is_published ? "Published to members" : "Private (only you)"}</p>
          </div>
          <Link href="/me/profile" className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white hover:text-black">{profile ? "Edit profile" : "Create profile"}</Link>
        </div>
      </section>

      <section className={card}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">My ideas</h2>
          <Link href="/submit" className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400">Submit an idea</Link>
        </div>
        {ideas.length === 0 ? <p className="text-gray-500">You haven&apos;t shared an idea yet.</p> : (
          <ul className="divide-y divide-white/10">
            {ideas.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <Link href={`/ideas/${i.id}`} className="font-medium hover:text-green-300">{i.project_name}</Link>
                  {i.moderation_note && <p className="text-xs text-gray-500">Note: {i.moderation_note}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {i.open_requests > 0 && <span className="text-xs text-green-400">{i.open_requests} open request{i.open_requests > 1 ? "s" : ""}</span>}
                  <span className={badge(i.status)}>{i.hidden_by_reports ? "Hidden (reports)" : STATUS[i.status] ?? i.status}</span>
                  <Link href={`/ideas/${i.id}/edit`} className="text-sm text-gray-400 underline hover:text-white">Edit</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {[{ title: "Requests received", rows: received, who: "requester_name" }, { title: "Requests sent", rows: sent, who: "owner_name" }].map((s) => (
        <section key={s.title} className={card}>
          <h2 className="mb-4 text-xl font-semibold">{s.title}</h2>
          {s.rows.length === 0 ? <p className="text-gray-500">None yet.</p> : (
            <ul className="divide-y divide-white/10">
              {s.rows.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <Link href={`/me/requests/${r.id}`} className="hover:text-green-300">
                    <span className="font-medium">{r.project_name}</span> <span className="text-sm text-gray-400">· {r[s.who]}</span>
                  </Link>
                  <span className={badge(r.status)}>{STATUS[r.status] ?? r.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      <section className={card}>
        <h2 className="mb-4 text-xl font-semibold">Email notifications</h2>
        {saved === "prefs" && <p className="mb-3 text-sm text-green-300">Preferences saved.</p>}
        <form action={emailPrefsAction} className="space-y-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requests" defaultChecked={prefs.requests !== false} className="h-4 w-4 accent-green-500" /> New collaboration requests on my ideas</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="reviews" defaultChecked={prefs.reviews !== false} className="h-4 w-4 accent-green-500" /> Review results for my ideas</label>
          <p className="text-xs text-gray-500">Introduction emails for requests you accept or that are accepted are always sent, since they&apos;re how you connect.</p>
          <button className="rounded-lg border border-white/20 px-4 py-2 text-sm">Save preferences</button>
        </form>
      </section>
    </main>
  );
}
