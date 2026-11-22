// One request page for every kind (collaboration, help offer, offer request). Server component.
import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDate, formatDateTime } from "@/lib/datetime";
import { getViewerCtx } from "@/lib/members";
import { redirect } from "next/navigation";
import * as R from "@/lib/requests-repo";
import { expiresOn, KIND_INFO, sideOf, type RequestKind } from "@/lib/requests";
import ConfirmButton from "@/components/ConfirmButton";
import { respondAction, retryIntroAction, withdrawRequestAction } from "@/app/me/actions";

const NOTICES: Record<string, string> = {
  "intro-sent": "Accepted. We've emailed you both an introduction.",
  "intro-failed": "Accepted, but the introduction email couldn't be sent yet. You can retry below, or the PANA team will follow up.",
  declined: "Declined. The member has been told politely.",
  withdrawn: "Withdrawn.",
  unavailable: "This can no longer be changed (it may have expired or already been answered).",
};
const STATUS: Record<string, string> = { pending: "Waiting for a reply", accepted: "Accepted", declined: "Declined", withdrawn: "Withdrawn", expired: "Expired" };

export default async function RequestDetail({ kind, id, notice }: { kind: RequestKind; id: string; notice?: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const path = KIND_INFO[kind].path(id.toLowerCase());
  const { ctx } = await getViewerCtx();
  if (!ctx.userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(path)}`);
  if (ctx.status !== "ok") redirect(`/welcome?next=${encodeURIComponent(path)}`);
  await R.expireAll();
  const r = await R.getOne(kind, id.toLowerCase());
  // Only the two sides see a request; admins also see offer requests (they answer for partners without contacts).
  const side = r ? sideOf(r, ctx.userId, ctx.isAdmin && kind === "offer") : null;
  if (!r || !side) notFound();
  const canRespond = side === "received" || side === "admin";
  const hidden = (<><input type="hidden" name="id" value={r.id} /><input type="hidden" name="kind" value={kind} /></>);
  const backHref = side === "admin" ? "/admin/partners#offer-requests" : "/me/requests";
  const who = kind === "offer" ? `${r.context}` : r.responder_name;

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link href={backHref} className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← {side === "admin" ? "Partners admin" : "My requests"}</Link>
      {notice && NOTICES[notice] && <p className="mb-6 rounded-xl border border-white/15 px-4 py-3 text-sm text-gray-300">{NOTICES[notice]}</p>}
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">{KIND_INFO[kind].label} · {STATUS[r.status] ?? r.status}</p>
      <h1 className="mb-2 text-3xl font-bold tracking-tight">
        {kind === "help" ? <>Help with &ldquo;{r.context}&rdquo;</> : <Link href={r.subject_href} className="hover:text-green-300">{r.subject_title}</Link>}
      </h1>
      {kind === "help" && <p className="mb-1 text-gray-400">On <Link href={`${r.subject_href}#needs`} className="text-green-400 underline">{r.subject_title}</Link></p>}
      {kind === "offer" && <p className="mb-1 text-gray-400">Offered by <Link href={r.subject_href} className="text-green-400 underline">{r.context}</Link>{r.extra ? <> · for the idea &ldquo;{r.extra}&rdquo;</> : null}</p>}
      <p className="mb-6 text-gray-400">
        {side === "sent"
          ? <>To {who}</>
          : <>From {r.requester_profile_visible ? <Link href={`/members/${r.requester}`} className="text-green-400 underline">{r.requester_name}</Link> : r.requester_name}{kind === "help" && r.extra ? <> (for {r.extra})</> : null}</>}
        {" · "}{formatDate(r.created_at)}
        {r.status === "pending" && <> · expires {formatDate(expiresOn(r.created_at))}</>}
      </p>
      <blockquote className="mb-8 whitespace-pre-line rounded-2xl border border-white/10 p-6 text-gray-200">{r.message}</blockquote>

      {side === "admin" && r.status === "pending" && (
        <p className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">
          {r.responders.length === 0 ? "This partner has no linked contacts, so PANA answers. If you accept, the introduction goes to the member and the PANA inbox." : "This partner has contacts; they normally answer. Accepting as admin introduces the member to the PANA inbox."}
        </p>
      )}
      {r.status === "pending" && canRespond && (
        <div className="flex flex-wrap gap-3">
          <form action={respondAction}>{hidden}<input type="hidden" name="decision" value="accept" />
            <ConfirmButton message="Accept? PANA will email you both an introduction that shares both email addresses." className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-black hover:bg-green-400">Accept &amp; introduce us</ConfirmButton></form>
          <form action={respondAction}>{hidden}<input type="hidden" name="decision" value="decline" />
            <button className="rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white hover:text-black">Decline</button></form>
        </div>
      )}
      {r.status === "pending" && side === "sent" && (
        <form action={withdrawRequestAction}>{hidden}
          <button className="rounded-xl border border-white/20 px-5 py-3 font-semibold hover:bg-white hover:text-black">Withdraw</button></form>
      )}
      {r.status === "accepted" && (
        r.intro_sent_at
          ? <p className="text-green-300">Introduction email sent {formatDateTime(r.intro_sent_at)}. Check your inbox.</p>
          : <div className="space-y-3"><p className="text-yellow-200">The introduction email hasn&apos;t been delivered yet.</p>
              {canRespond && <form action={retryIntroAction}>{hidden}<button className="rounded-lg border border-white/20 px-4 py-2 text-sm">Retry introduction email</button></form>}</div>
      )}
      <p className="mt-10 text-xs text-gray-500">Email addresses are never shown on PANA. They&apos;re shared only in the introduction email after a request is accepted. PANA doesn&apos;t give money or equipment; it connects people.</p>
    </main>
  );
}
