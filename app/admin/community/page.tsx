import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import ConfirmButton from "@/components/ConfirmButton";
import { adminPosts, adminQueue, digestAudience, digestCandidates, lastDigest } from "@/lib/community-repo";
import { BOARD_LIMITS, DIGEST_BATCH, DIGEST_INTERVAL_DAYS, digestState, kindLabel } from "@/lib/community";
import { formatDateTime, formatEventRange } from "@/lib/datetime";
import { continueDigestAction, moderateAction, startDigestAction } from "./actions";

const NOTICE: Record<string, string> = {
  deleted: "Draft deleted.", "board-approve": "Approved. The member's next posts publish straight away.", "board-decline": "Declined. The member was told by email (if they allow review emails).",
  "board-remove": "Removed from the board.", "board-restore": "Restored and reports dismissed.", "board-keep": "Kept; reports dismissed.",
};

export default async function AdminCommunityPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string; sent?: string; failed?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [queue, posts, last, audience] = await Promise.all([adminQueue(), adminPosts(), lastDigest(), digestAudience()]);
  const st = digestState(last as never);
  const candidates = st.canStart ? await digestCandidates(last ? String(last.created_at) : null) : [];
  const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold";
  const decide = (q: Record<string, unknown>, decision: string, label: string, cls: string, confirm?: string) => (
    <form action={moderateAction} className="contents">
      <input type="hidden" name="type" value={String(q.type)} /><input type="hidden" name="id" value={String(q.id)} /><input type="hidden" name="decision" value={decision} />
      <input type="hidden" name="note" value="" />
      {confirm ? <ConfirmButton message={confirm} className={`${btn} ${cls}`}>{label}</ConfirmButton> : <button className={`${btn} ${cls}`}>{label}</button>}
    </form>
  );

  return (
    <section className="space-y-12">
      {sp.notice === "digest" && <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">Digest batch done: {Number(sp.sent) || 0} handled, {Number(sp.failed) || 0} failed.</p>}
      {sp.notice && NOTICE[sp.notice] && <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{NOTICE[sp.notice]}</p>}
      <AdminNotice error={sp.error} />

      <div id="queue">
        <h2 className="mb-2 text-xl font-semibold">Community board: to review ({queue.length})</h2>
        <p className="mb-4 text-sm text-gray-400">
          Light-touch moderation: a member&apos;s first post or reply waits here. Once you approve one, their later posts publish straight away.
          Anything with 3 reports hides itself until you look. Contact details and money amounts are blocked automatically.
        </p>
        {queue.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-gray-400">Nothing to review.</p> : (
          <ul className="space-y-4">
            {queue.map((q) => (
              <li key={`${q.type}-${q.id}`} className="rounded-2xl border border-white/10 p-5">
                <p className="text-xs uppercase tracking-wider text-gray-500">
                  {q.type === "post" ? `${kindLabel(String(q.kind))} post` : "Reply"} · {String(q.author_name)} · {formatDateTime(q.created_at as string)}
                  {" · "}<span className={q.status === "pending" ? "text-yellow-200" : ""}>{String(q.status)}</span>
                  {q.hidden_by_reports ? <span className="ml-1 text-red-300">· hidden by reports</span> : null}
                  {Number(q.open_reports) > 0 && <span className="ml-1 text-red-300">· {Number(q.open_reports)} open report(s)</span>}
                </p>
                <p className="mt-1 font-semibold">{q.type === "reply" ? `On: ${String(q.post_title)}` : String(q.post_title)}</p>
                <p className="mt-2 max-w-3xl whitespace-pre-line text-sm text-gray-300">{String(q.body)}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {q.status === "pending" && decide(q, "approve", "Approve", "border-green-500/40 text-green-300 hover:bg-green-500/10")}
                  {q.status === "pending" && (
                    <form action={moderateAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="type" value={String(q.type)} /><input type="hidden" name="id" value={String(q.id)} /><input type="hidden" name="decision" value="decline" />
                      <input name="note" maxLength={BOARD_LIMITS.note} placeholder="Optional note to the member" className="rounded-lg border border-white/10 bg-black px-3 py-1.5 text-xs" />
                      <button className={`${btn} border-white/20 hover:bg-white/10`}>Decline</button>
                    </form>
                  )}
                  {q.status === "published" && (q.hidden_by_reports ? decide(q, "restore", "Restore", "border-green-500/40 text-green-300 hover:bg-green-500/10") : decide(q, "keep", "Keep (dismiss reports)", "border-white/20 hover:bg-white/10"))}
                  {(q.status === "published") && decide(q, "remove", "Remove", "border-red-500/40 text-red-300 hover:bg-red-500/10", "Remove this from the board?")}
                  <Link href={`/community/board/${String(q.post_id)}`} className="text-xs text-gray-400 underline">Open on the board</Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Announcements &amp; events ({posts.length})</h2>
          <Link href="/admin/community/new" className="rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400">New announcement or event</Link>
        </div>
        {posts.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-8 text-gray-400">Nothing yet.</p> : (
          <ul className="space-y-2">
            {posts.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-4">
                <div>
                  <Link href={`/admin/community/${p.id}`} className="font-semibold hover:text-green-300">{p.title}</Link>
                  <p className="text-xs text-gray-500">
                    {p.kind}{p.kind === "event" && p.starts_at ? ` · ${formatEventRange(p.starts_at, p.ends_at).day}` : ""} · {p.program} · {p.audience === "members" ? "members only" : "public"}{p.pinned ? " · pinned" : ""}
                    {p.kind === "event" ? ` · price: ${p.price_text || "—"} · ${p.registration_url ? "registration link set" : "no registration link"}` : ""}
                  </p>
                </div>
                <span className={`rounded-full px-2 py-1 text-xs ${p.status === "published" ? "bg-green-500/15 text-green-300" : "bg-white/10 text-gray-300"}`}>{p.status}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div id="digest">
        <h2 className="mb-2 text-xl font-semibold">Community digest email</h2>
        <p className="mb-4 text-sm text-gray-400">
          Members choose to get it (off by default). It includes only your announcements and events, never member posts, and can go out at most once every {DIGEST_INTERVAL_DAYS} days.
          It sends {DIGEST_BATCH} emails a day to stay within the free email plan. <strong className="text-gray-200">{audience}</strong> member(s) have opted in.
        </p>
        {last && (
          <p className="mb-4 text-sm text-gray-400">Last digest started {formatDateTime(last.created_at as string)}: {Number(last.sent)} handled, {Number(last.remaining)} still to send.
            {st.nextStart && !st.canStart && Number(last.remaining) === 0 ? ` Next one can start after ${formatDateTime(st.nextStart)}.` : ""}</p>
        )}
        {st.canContinue && (
          <form action={continueDigestAction} className="mb-4"><button className={`${btn} border-green-500/40 text-green-300 hover:bg-green-500/10`}>Send the next batch</button></form>
        )}
        {st.canStart && (candidates.length === 0 ? <p className="text-sm text-gray-500">Nothing new to send. Publish an announcement or event first.</p> : (
          <form action={startDigestAction} className="space-y-3 rounded-2xl border border-white/10 p-5">
            <p className="text-sm text-gray-300">Choose what to include:</p>
            {candidates.map((c) => (
              <label key={c.id} className="flex items-start gap-2 text-sm">
                <input type="checkbox" name="post" value={c.id} defaultChecked className="mt-1 accent-green-500" />
                <span>{c.title} <span className="text-gray-500">({c.kind === "event" && c.starts_at ? formatEventRange(c.starts_at, c.ends_at).day : "announcement"}{c.audience === "members" ? ", members only" : ""})</span></span>
              </label>
            ))}
            <ConfirmButton message={`Send the digest to ${audience} opted-in member(s)? (Up to ${DIGEST_BATCH} today, the rest in daily batches.)`} className={`${btn} border-green-500/40 text-green-300 hover:bg-green-500/10`}>Send digest</ConfirmButton>
          </form>
        ))}
      </div>
    </section>
  );
}
