import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import sql from "@/lib/db";
import { isClerkUserId } from "@/lib/clerk-sync";
import { getViewerCtx, requireMember } from "@/lib/members";
import { mentorOne } from "@/lib/mentors-repo";
import { EXPERTISE, label } from "@/lib/mentors";
import { REPORT_REASONS } from "@/lib/profile-input";
import * as R from "@/lib/requests-repo";
import MentorshipForm from "@/components/MentorshipForm";
import { reportMentorAction, requestMentorshipAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Mentor", robots: { index: false, follow: false } };

const NOTICES: Record<string, string> = {
  reported: "Thanks. Your report was sent to the PANA team.",
  duplicate: "You've already reported this mentor.",
  self: "You can't report yourself.",
  invalid: "Please choose a reason for your report.",
};

export default async function MentorPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ report?: string }> }) {
  const { id } = await params;
  if (!isClerkUserId(id)) notFound();
  await requireMember(`/mentors/${id}`, { currentTerms: true });
  const { ctx } = await getViewerCtx();
  const { report } = await searchParams;
  const m = await mentorOne(id);
  const isSelf = ctx.userId === id;
  // Others only see approved mentors with active accounts whose profile isn't hidden; the mentor and admins always can.
  const listed = !!m && m.status === "approved" && m.member_status === "active" && m.moderation === "ok";
  if (!m || (!listed && !isSelf && !ctx.isAdmin)) notFound();
  const full = m.open_load >= m.max_open_mentees;
  const open = !isSelf && ctx.userId ? await R.hasOpen("mentorship", id, ctx.userId) : false;
  const myIdeas = !isSelf && ctx.userId
    ? (await sql`SELECT id::text AS id, project_name AS name FROM projects WHERE user_id = ${ctx.userId} AND status = 'approved' AND NOT hidden_by_reports ORDER BY created_at DESC LIMIT 20`) as { id: string; name: string }[]
    : [];
  const inp = "rounded-lg border border-white/10 bg-black px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Link href="/mentors" className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← Mentors</Link>
      {report && NOTICES[report] && <p className="mb-6 rounded-xl border border-white/15 px-4 py-3 text-sm text-gray-300">{NOTICES[report]}</p>}
      {!listed && <p className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">Not shown to members right now ({m.status}). Only you and admins can see this page.</p>}
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-4xl font-bold tracking-tight">{m.name}</h1>
        <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs text-green-300">PANA mentor</span>
      </div>
      {m.headline && <p className="mt-2 text-lg text-gray-400">{m.headline}</p>}
      {m.profile_visible && <Link href={`/members/${m.user_id}`} className="mt-2 inline-block text-sm text-green-400 underline">Member profile</Link>}
      <div className="mt-6 flex flex-wrap gap-2">{m.expertise.map((e) => <span key={e} className="rounded-full border border-white/15 px-3 py-1 text-sm">{label(EXPERTISE, e)}</span>)}</div>
      <p className="mt-6 whitespace-pre-line text-gray-300">{m.bio}</p>
      {m.availability && <p className="mt-4 text-sm text-gray-400">Availability: {m.availability}</p>}

      {!isSelf && (
        <section className="mt-12 rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 to-transparent p-6">
          <h2 className="mb-2 text-xl font-semibold">Request mentorship</h2>
          {open ? (
            <p className="text-gray-300">You&apos;ve sent a request. Track it in <Link href="/me/requests?tab=mentorship" className="text-green-400 underline">My requests</Link>.</p>
          ) : full || !listed ? (
            <p className="text-gray-400">{m.name} isn&apos;t taking new requests right now. Try another <Link href="/mentors" className="text-green-400 underline">mentor</Link>.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-gray-400">Your email isn&apos;t shared. If they accept, PANA introduces you both by email. Up to 5 mentorship requests a day.</p>
              <MentorshipForm action={requestMentorshipAction.bind(null, id)} ideas={myIdeas} />
            </>
          )}
        </section>
      )}
      {isSelf && <p className="mt-12 text-sm text-gray-400">This is how members see you. <Link href="/me/profile#mentor" className="text-green-400 underline">Edit or pause</Link> · <Link href="/me/requests?tab=mentorship" className="text-green-400 underline">Your mentorship requests</Link></p>}

      {!isSelf && (
        <details className="mt-12 rounded-2xl border border-white/10 p-6">
          <summary className="cursor-pointer text-sm text-gray-400">Report this mentor</summary>
          <form action={reportMentorAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="target" value={m.user_id} />
            <select name="reason" required defaultValue="" className={inp}>
              <option value="" disabled>Choose a reason</option>
              {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            <textarea name="details" maxLength={500} rows={3} placeholder="Anything we should know? (optional)" className={inp} />
            <button className="self-start rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300 hover:bg-red-500/10">Send report</button>
          </form>
        </details>
      )}
    </main>
  );
}
