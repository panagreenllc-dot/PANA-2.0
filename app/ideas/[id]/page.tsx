import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import sql from "@/lib/db";
import { parseProjectId } from "@/lib/ids";
import { getViewerCtx } from "@/lib/members";
import { getIdea, hasOpenRequest } from "@/lib/ideas-repo";
import { HELP_NEEDED, KINDS, STAGES } from "@/lib/ideas";
import { REPORT_REASONS } from "@/lib/profile-input";
import { isGatedMember, needIsOpenFor, toIdeaView, toNeedView } from "@/lib/visibility";
import { ideaNeeds } from "@/lib/needs-repo";
import { ACTIVE_NEED_STATUSES, MAX_ACTIVE_NEEDS, NEED_KINDS, NEED_STATUS_LABEL } from "@/lib/needs";
import * as R from "@/lib/requests-repo";
import { myPartners } from "@/lib/partner-portal-repo";
import NeedForm from "@/components/NeedForm";
import HelpForm from "@/components/HelpForm";
import { addNeedAction, needStatusAction, offerHelpAction, updateNeedAction } from "../needs-actions";
import CollabForm from "@/components/CollabForm";
import ConfirmButton from "@/components/ConfirmButton";
import { reportIdeaAction, requestCollabAction, resubmitIdeaAction, withdrawIdeaAction } from "../actions";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const id = parseProjectId((await params).id);
  const idea = id ? await getIdea(id).catch(() => null) : null;
  const indexable = idea && idea.status === "approved" && idea.audience === "public" && !idea.hidden_by_reports;
  return indexable
    ? { title: idea.project_name, description: idea.description?.slice(0, 160) ?? undefined }
    : { title: "Idea", robots: { index: false, follow: false } };
}

const label = (list: readonly { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;
const STATUS_TEXT: Record<string, string> = {
  pending: "Waiting for review. Only you and admins can see it.",
  changes_requested: "Changes requested by the PANA team. Edit it to resubmit.",
  rejected: "Not approved. Edit it to resubmit.",
  withdrawn: "Withdrawn. Only you and admins can see it.",
};
const NOTICES: Record<string, string> = {
  withdrawn: "Your idea is withdrawn and no longer visible.",
  resubmitted: "Your idea is back in the review queue.",
  "report-reported": "Thanks. Your report was sent to the PANA team.",
  "report-duplicate": "You've already reported this idea.",
  "report-self": "You can't report your own idea.",
  "report-invalid": "Please choose a reason for your report.",
  "need-met": "Marked as met. Thanks for keeping your needs up to date.",
  "need-closed": "Need closed.",
  "need-open": "Need re-opened.",
};

export default async function IdeaPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const id = parseProjectId((await params).id);
  if (!id || !id.includes("-")) notFound();
  const { notice } = await searchParams;
  const { ctx } = await getViewerCtx();
  const idea = await getIdea(id);
  if (!idea) notFound();
  const v = toIdeaView(ctx, idea);
  if (!v) notFound();

  const isOwner = !!ctx.userId && ctx.userId === idea.user_id;
  const gated = isGatedMember(ctx);
  const live = idea.status === "approved" && !idea.hidden_by_reports;
  const [owner] = idea.user_id && gated
    ? await sql`SELECT user_id, display_name FROM profiles WHERE user_id = ${idea.user_id} AND is_published AND moderation = 'ok'`
    : [];
  const open = gated && !isOwner && ctx.userId ? await hasOpenRequest(id, ctx.userId) : false;
  const inp = "rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white";
  // Needs: never more visible than the idea (toNeedView), only reviewed needs for everyone but the owner/admins.
  const needs = (await ideaNeeds(id)).map((n) => ({ row: n, view: toNeedView(ctx, idea, n) })).filter((x) => x.view);
  const activeNeeds = needs.filter((x) => (ACTIVE_NEED_STATUSES as readonly string[]).includes(x.row.status)).length;
  const offered = new Set<string>();
  if (gated && !isOwner && ctx.userId) {
    for (const x of needs) if (x.row.status === "open" && (await R.hasOpen("help", x.row.id, ctx.userId))) offered.add(x.row.id);
  }
  const helperPartners = gated && !isOwner && ctx.userId && needs.some((x) => x.row.status === "open")
    ? (await myPartners(ctx.userId).catch(() => [])).filter((p) => p.status === "approved").map((p) => ({ id: String(p.id), name: String(p.name) }))
    : [];
  const needKind = (k: string) => NEED_KINDS.find((x) => x.value === k)?.label ?? k;

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Link href="/ideas" className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← Explore Ideas</Link>
      {notice && NOTICES[notice] && <p className="mb-6 rounded-xl border border-white/15 px-4 py-3 text-sm text-gray-300">{NOTICES[notice]}</p>}
      {(isOwner || ctx.isAdmin) && (!live || idea.status !== "approved") && (
        <div className="mb-6 rounded-xl border border-yellow-500/40 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
          <p>{idea.hidden_by_reports ? "Hidden after member reports, pending admin review." : STATUS_TEXT[idea.status] ?? idea.status}</p>
          {idea.moderation_note && <p className="mt-1">Note from the PANA team: {idea.moderation_note}</p>}
        </div>
      )}

      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">
        {[v.category, label(KINDS, v.kind), label(STAGES, v.stage)].filter(Boolean).join(" · ")}
        {idea.audience === "members" && " · Members only"}
      </p>
      <h1 className="mb-3 text-4xl font-bold tracking-tight">{v.project_name}</h1>
      <p className="mb-8 text-sm text-gray-400">
        by {owner ? <Link href={`/members/${owner.user_id}`} className="text-green-400 underline">{owner.display_name}</Link> : idea.name ?? "a PANA member"}
      </p>

      <p className="whitespace-pre-line text-lg text-gray-300">{v.description}</p>
      {v.details && (<section className="mt-8"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Details</h2><p className="whitespace-pre-line text-gray-300">{v.details}</p></section>)}
      {v.help_needed && (<section className="mt-8"><h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-500">Help needed</h2>
        <div className="flex flex-wrap gap-2">{v.help_needed.map((h) => <span key={h} className="rounded-full border border-white/15 px-3 py-1 text-sm">{label(HELP_NEEDED, h)}</span>)}</div></section>)}
      {v.website && <a href={v.website} target="_blank" rel="noopener noreferrer nofollow ugc" className="mt-8 inline-block font-semibold text-green-400 hover:text-green-300">Visit website →</a>}
      {!gated && <p className="mt-8 text-sm text-gray-500">Some details may be visible to signed-in members only.</p>}

      {(needs.length > 0 || isOwner) && (
        <section id="needs" className="mt-12 rounded-2xl border border-white/10 p-6">
          <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-xl font-semibold">Needs</h2>
            {isOwner && <span className="text-xs text-gray-500">{activeNeeds}/{MAX_ACTIVE_NEEDS} active</span>}
          </div>
          <p className="mb-4 text-sm text-gray-400">
            {isOwner
              ? "List the access or help this idea needs. The PANA team reviews each need; members who can see your idea can then offer help. PANA connects people; it doesn't give money or equipment."
              : "What this idea is looking for. Offer help and, if the owner accepts, PANA introduces you both by email."}
          </p>
          {needs.length === 0 ? <p className="text-gray-500">No needs listed yet.</p> : (
            <ul className="space-y-4">
              {needs.map(({ row: n, view }) => (
                <li key={n.id} className="rounded-xl border border-white/10 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-xs uppercase tracking-wider text-green-400">{needKind(n.kind)}{n.amount_text ? ` · ${n.amount_text}` : ""}</p>
                      <p className="font-medium">{n.title}</p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${n.status === "open" ? "bg-green-500/15 text-green-300" : n.status === "pending" || n.status === "changes_requested" ? "bg-yellow-500/15 text-yellow-200" : "bg-white/10 text-gray-300"}`}>{NEED_STATUS_LABEL[n.status] ?? n.status}</span>
                  </div>
                  {n.details && <p className="mt-2 whitespace-pre-line text-sm text-gray-300">{n.details}</p>}
                  {view!.moderation_note && n.status === "changes_requested" && (isOwner || ctx.isAdmin) && <p className="mt-2 text-sm text-yellow-200">Note from the PANA team: {view!.moderation_note}</p>}
                  {isOwner && (
                    <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
                      {n.status === "open" && <form action={needStatusAction}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="to" value="met" /><button className="rounded-lg border border-green-500/40 px-3 py-1.5 text-green-300 hover:bg-green-500/10">Mark as met</button></form>}
                      {n.status === "met" && <form action={needStatusAction}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="to" value="open" /><button className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10">Re-open</button></form>}
                      {n.status !== "closed" && <form action={needStatusAction}><input type="hidden" name="id" value={n.id} /><input type="hidden" name="to" value="closed" /><ConfirmButton message="Close this need? Members won't see it anymore." className="rounded-lg border border-white/20 px-3 py-1.5 text-gray-300 hover:bg-white/10">Close</ConfirmButton></form>}
                      {n.status !== "closed" && (
                        <details className="w-full">
                          <summary className="cursor-pointer text-gray-400 hover:text-white">Edit</summary>
                          <div className="mt-3"><NeedForm action={updateNeedAction.bind(null, n.id)} initial={{ kind: n.kind, title: n.title, details: n.details, amount_text: n.amount_text }} submitLabel="Save need" /></div>
                        </details>
                      )}
                    </div>
                  )}
                  {!isOwner && n.status === "open" && (
                    <div className="mt-3">
                      {ctx.status === "anon" ? (
                        <p className="text-sm text-gray-400"><Link href={`/sign-in?redirect_url=/ideas/${id}%23needs`} className="text-green-400 underline">Sign in</Link> or <Link href="/sign-up" className="text-green-400 underline">join PANA</Link> to offer help.</p>
                      ) : !gated ? (
                        <p className="text-sm text-gray-400"><Link href={`/welcome?next=/ideas/${id}`} className="text-green-400 underline">Finish joining</Link> to offer help.</p>
                      ) : offered.has(n.id) ? (
                        <p className="text-sm text-gray-300">You&apos;ve offered to help. Track it in <Link href="/me/requests?tab=help" className="text-green-400 underline">My requests</Link>.</p>
                      ) : needIsOpenFor(ctx, idea, n) ? (
                        <details>
                          <summary className="cursor-pointer text-sm font-semibold text-green-400 hover:text-green-300">Offer help</summary>
                          <div className="mt-3"><HelpForm action={offerHelpAction.bind(null, n.id)} partners={helperPartners} needTitle={n.title} /></div>
                        </details>
                      ) : null}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
          {isOwner && idea.status !== "rejected" && idea.status !== "withdrawn" && activeNeeds < MAX_ACTIVE_NEEDS && (
            <details className="mt-6" open={needs.length === 0}>
              <summary className="cursor-pointer text-sm font-semibold text-green-400 hover:text-green-300">Add a need</summary>
              <div className="mt-3"><NeedForm action={addNeedAction.bind(null, id)} submitLabel="Add need" /></div>
            </details>
          )}
        </section>
      )}

      {isOwner && (
        <section className="mt-12 flex flex-wrap gap-3 rounded-2xl border border-white/10 p-6">
          <Link href={`/ideas/${id}/edit`} className="rounded-xl bg-green-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-green-400">Edit idea &amp; privacy</Link>
          <Link href="/me/requests" className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white hover:text-black">Requests &amp; offers</Link>
          {idea.status === "withdrawn" ? (
            <form action={resubmitIdeaAction}><input type="hidden" name="id" value={id} />
              <button className="rounded-xl border border-white/20 px-5 py-2.5 text-sm font-semibold hover:bg-white hover:text-black">Resubmit for review</button></form>
          ) : (
            <form action={withdrawIdeaAction}><input type="hidden" name="id" value={id} />
              <ConfirmButton message="Withdraw this idea? It will be hidden until you resubmit it." className="rounded-xl border border-red-500/40 px-5 py-2.5 text-sm font-semibold text-red-300 hover:bg-red-500/10">Withdraw</ConfirmButton></form>
          )}
        </section>
      )}

      {!isOwner && live && (
        <section className="mt-12 rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 to-transparent p-6">
          <h2 className="mb-2 text-xl font-semibold">Want to help build this?</h2>
          {ctx.status === "anon" ? (
            <p className="text-gray-400"><Link href={`/sign-in?redirect_url=/ideas/${id}`} className="text-green-400 underline">Sign in</Link> or <Link href="/sign-up" className="text-green-400 underline">join PANA</Link> to send a collaboration request.</p>
          ) : !gated ? (
            <p className="text-gray-400"><Link href={`/welcome?next=/ideas/${id}`} className="text-green-400 underline">Finish joining</Link> (18+ confirmation) to send a request.</p>
          ) : open ? (
            <p className="text-gray-300">You&apos;ve sent a request. Track it in <Link href="/me/requests" className="text-green-400 underline">My requests</Link>.</p>
          ) : (
            <>
              <p className="mb-4 text-sm text-gray-400">Your email isn&apos;t shared. If the owner accepts, PANA introduces you both by email.</p>
              <CollabForm action={requestCollabAction.bind(null, id)} />
            </>
          )}
        </section>
      )}

      {gated && !isOwner && live && (
        <details className="mt-8 rounded-2xl border border-white/10 p-6">
          <summary className="cursor-pointer text-sm text-gray-400">Report this idea</summary>
          <form action={reportIdeaAction} className="mt-4 flex flex-col gap-3">
            <input type="hidden" name="id" value={id} />
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
