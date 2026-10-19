import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { expireStale, listRequests } from "@/lib/ideas-repo";
import { REQUEST_EXPIRY_DAYS } from "@/lib/collab";
import ConfirmButton from "@/components/ConfirmButton";
import { respondAction, retryIntroAction, withdrawRequestAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collaboration request", robots: { index: false, follow: false } };

const NOTICES: Record<string, string> = {
  "intro-sent": "Accepted. We've emailed you both an introduction.",
  "intro-failed": "Accepted, but the introduction email couldn't be sent yet. You can retry below, or the PANA team will follow up.",
  declined: "Declined. The member has been told politely.",
  withdrawn: "Request withdrawn.",
  unavailable: "This request can no longer be changed (it may have expired or already been answered).",
};

export default async function RequestPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { userId } = await requireMember(`/me/requests/${id}`);
  const { notice } = await searchParams;
  await expireStale();
  const { received, sent } = await listRequests(userId); // only requests involving this member
  const r = [...received, ...sent].find((x) => x.id === id.toLowerCase());
  if (!r) notFound();
  const isOwner = r.owner_user_id === userId;
  const expires = new Date(new Date(r.created_at).getTime() + REQUEST_EXPIRY_DAYS * 86400000);

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link href="/me" className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← My PANA</Link>
      {notice && NOTICES[notice] && <p className="mb-6 rounded-xl border border-white/15 px-4 py-3 text-sm text-gray-300">{NOTICES[notice]}</p>}
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Collaboration request · {r.status}</p>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        <Link href={`/ideas/${r.project_id}`} className="hover:text-green-300">{r.project_name}</Link>
      </h1>
      <p className="mb-6 text-gray-400">
        {isOwner ? <>From {r.requester_profile_visible ? <Link href={`/members/${r.requester_user_id}`} className="text-green-400 underline">{r.requester_name}</Link> : r.requester_name}</> : <>To {r.owner_name}</>}
        {" · "}{new Date(r.created_at).toLocaleDateString()}
        {r.status === "pending" && <> · expires {expires.toLocaleDateString()}</>}
      </p>
      <blockquote className="mb-8 whitespace-pre-line rounded-2xl border border-white/10 p-6 text-gray-200">{r.message}</blockquote>

      {r.status === "pending" && isOwner && (
        <div className="flex flex-wrap gap-3">
          <form action={respondAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="accept" />
            <ConfirmButton message="Accept? PANA will email you both an introduction that shares both of your email addresses." className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-black hover:bg-green-400">Accept &amp; introduce us</ConfirmButton></form>
          <form action={respondAction}><input type="hidden" name="id" value={r.id} /><input type="hidden" name="decision" value="decline" />
            <button className="rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white hover:text-black">Decline</button></form>
        </div>
      )}
      {r.status === "pending" && !isOwner && (
        <form action={withdrawRequestAction}><input type="hidden" name="id" value={r.id} />
          <button className="rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white hover:text-black">Withdraw request</button></form>
      )}
      {r.status === "accepted" && (
        r.intro_sent_at
          ? <p className="text-green-300">Introduction email sent {new Date(r.intro_sent_at).toLocaleString()}. Check your inbox.</p>
          : <div className="space-y-3"><p className="text-yellow-200">The introduction email hasn&apos;t been delivered yet.</p>
              {isOwner && <form action={retryIntroAction}><input type="hidden" name="id" value={r.id} /><button className="rounded-lg border border-white/20 px-4 py-2 text-sm">Retry introduction email</button></form>}</div>
      )}
      <p className="mt-10 text-xs text-gray-500">Your email address is never shown on PANA. It&apos;s shared only in the introduction email after a request is accepted.</p>
    </main>
  );
}
