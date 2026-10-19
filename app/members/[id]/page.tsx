import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { isClerkUserId } from "@/lib/clerk-sync";
import { getViewerCtx, requireMember } from "@/lib/members";
import { getProfileRow, ideasOf } from "@/lib/profiles-repo";
import { REPORT_REASONS } from "@/lib/profile-input";
import { toIdeaView, toProfileView } from "@/lib/visibility";
import { ProfileDetails } from "@/components/ProfileView";
import { reportProfileAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Member", robots: { index: false, follow: false } };

const NOTICES: Record<string, string> = {
  reported: "Thanks. Your report was sent to the PANA team.",
  duplicate: "You've already reported this profile.",
  self: "You can't report your own profile.",
  invalid: "Please choose a reason for your report.",
};

export default async function MemberPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ report?: string }> }) {
  const { id } = await params;
  if (!isClerkUserId(id)) notFound();
  await requireMember(`/members/${id}`);
  const { ctx } = await getViewerCtx();
  const { report } = await searchParams;

  const row = await getProfileRow(id);
  const p = row ? toProfileView(ctx, row) : null;
  if (!p) notFound();
  const ideas = (await ideasOf(id)).map((i) => toIdeaView(ctx, i)).filter((i) => i !== null);
  const inp = "rounded-lg border border-white/10 bg-black px-3 py-2 text-sm";

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Link href="/members" className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← Members</Link>
      {report && NOTICES[report] && <p className="mb-6 rounded-xl border border-white/15 px-4 py-3 text-sm text-gray-300">{NOTICES[report]}</p>}
      {p.state && (!p.state.is_published || p.state.moderation !== "ok") && (
        <p className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          {p.state.moderation !== "ok" ? "This profile is hidden by moderators. Only its owner and admins can see it." : "This profile is private. Only you (and admins) can see it."}
          {p.isOwner && <> <Link href="/me/profile" className="underline">Edit or publish</Link></>}
        </p>
      )}

      <ProfileDetails p={p} />

      <section className="mt-12">
        <h2 className="mb-4 text-2xl font-semibold">Ideas & projects</h2>
        {ideas.length === 0 ? (
          <p className="text-gray-500">No approved ideas yet.</p>
        ) : (
          <div className="space-y-4">
            {ideas.map((i) => (
              <article key={i.id} className="rounded-2xl border border-white/10 p-6">
                <p className="mb-1 text-xs uppercase tracking-wider text-green-400">{[i.category, i.kind, i.stage].filter(Boolean).join(" · ")}</p>
                <h3 className="text-lg font-semibold">{i.project_name}</h3>
                {i.description && <p className="mt-2 text-sm text-gray-400">{i.description}</p>}
                {i.details && <p className="mt-2 whitespace-pre-line text-sm text-gray-300">{i.details}</p>}
                {i.help_needed && <p className="mt-2 text-xs text-gray-400">Help needed: {i.help_needed.join(", ")}</p>}
                {i.website && <a href={i.website} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-2 inline-block text-sm text-green-400 underline">Website</a>}
              </article>
            ))}
          </div>
        )}
      </section>

      {!p.isOwner && (
        <details className="mt-12 rounded-2xl border border-white/10 p-6">
          <summary className="cursor-pointer text-sm text-gray-400">Report this profile</summary>
          <form action={reportProfileAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="target" value={p.user_id} />
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
