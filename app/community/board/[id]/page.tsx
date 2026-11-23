import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ConfirmButton from "@/components/ConfirmButton";
import { ReplyForm } from "@/components/BoardForms";
import { boardPost, repliesOf } from "@/lib/community-repo";
import { kindLabel } from "@/lib/community";
import { formatDateTime } from "@/lib/datetime";
import { parseUuid } from "@/lib/incubator";
import { isAdminUser } from "@/lib/auth";
import { requireMember } from "@/lib/members";
import { REPORT_REASONS } from "@/lib/profile-input";
import { deletePostAction, deleteReplyAction, replyAction, reportBoardAction } from "../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Community board", robots: { index: false, follow: false } };

const inp = "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white";
const REPORT_NOTICE: Record<string, string> = {
  reported: "Thanks. The PANA team will take a look.", duplicate: "You already reported this.", invalid: "Choose a reason for the report.",
};

function Report({ type, id, postId }: { type: "post" | "reply"; id: string; postId: string }) {
  return (
    <details className="mt-2">
      <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-300">Report</summary>
      <form action={reportBoardAction} className="mt-2 flex max-w-md flex-col gap-2">
        <input type="hidden" name="type" value={type} /><input type="hidden" name="id" value={id} /><input type="hidden" name="post_id" value={postId} />
        <select name="reason" required defaultValue="" className={inp}>
          <option value="" disabled>Choose a reason</option>
          {REPORT_REASONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <textarea name="details" maxLength={500} rows={2} placeholder="Anything we should know? (optional)" className={inp} />
        <button className="self-start rounded-lg border border-red-500/40 px-3 py-1.5 text-xs text-red-300 hover:bg-red-500/10">Send report</button>
      </form>
    </details>
  );
}

function Author({ name, userId, visible }: { name: string; userId: string; visible: boolean }) {
  return visible ? <Link href={`/members/${userId}`} className="text-green-400 hover:text-green-300">{name}</Link> : <span>{name}</span>;
}

export default async function BoardPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ report?: string; notice?: string }> }) {
  const { id: raw } = await params;
  const sp = await searchParams;
  const id = parseUuid(raw);
  if (!id) notFound();
  const v = await requireMember(`/community/board/${id}`, { currentTerms: true });
  const admin = isAdminUser(v.user);
  const post = await boardPost(id, v.userId, admin);
  if (!post) notFound();
  const replies = await repliesOf(id, v.userId, admin);
  const mine = post.user_id === v.userId;
  const live = post.status === "published" && !post.hidden_by_reports;

  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <Link href="/community/board" className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← Community board</Link>
      {sp.report && REPORT_NOTICE[sp.report] && <p role="status" className="mb-4 text-sm text-green-300">{REPORT_NOTICE[sp.report]}</p>}
      {sp.notice === "reply-deleted" && <p role="status" className="mb-4 text-sm text-green-300">Your reply was deleted.</p>}
      {post.status === "pending" && <p className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-100">Waiting for a quick review by the PANA team. Only you{admin ? " and admins" : ""} can see it for now.</p>}
      {post.status === "declined" && <p className="mb-4 rounded-xl border border-white/15 px-4 py-3 text-sm text-gray-300">This post wasn&apos;t approved.{post.review_note ? ` Note from PANA: ${post.review_note}` : ""}</p>}
      {admin && (post.hidden_by_reports || post.status === "removed") && <p className="mb-4 rounded-xl border border-red-500/30 px-4 py-3 text-sm text-red-200">Admin view: {post.status === "removed" ? "removed" : "hidden by reports"}. Manage it in <Link href="/admin/community" className="underline">Admin → Community</Link>.</p>}

      <p className="text-xs font-semibold uppercase tracking-[0.3em] text-green-400">{kindLabel(post.kind)}</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight">{post.title}</h1>
      <p className="mt-2 text-sm text-gray-500"><Author name={post.author_name} userId={post.user_id} visible={post.author_profile_visible} /> · {formatDateTime(post.created_at)}</p>
      <div className="mt-6 whitespace-pre-line text-gray-200">{post.body}</div>
      <div className="mt-4 flex gap-4">
        {mine && (
          <form action={deletePostAction}><input type="hidden" name="id" value={post.id} />
            <ConfirmButton message="Delete this post and its replies?" className="text-xs text-gray-400 underline hover:text-white">Delete my post</ConfirmButton></form>
        )}
      </div>
      {!mine && live && <Report type="post" id={post.id} postId={post.id} />}

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Replies ({replies.filter((r) => r.status === "published" && !r.hidden_by_reports).length})</h2>
        {replies.length === 0 ? <p className="text-gray-500">No replies yet.</p> : (
          <ul className="space-y-4">
            {replies.map((r) => (
              <li key={r.id} className="rounded-2xl border border-white/10 p-4">
                <p className="text-xs text-gray-500"><Author name={r.author_name} userId={r.user_id} visible={r.author_profile_visible} /> · {formatDateTime(r.created_at)}
                  {r.status === "pending" && <span className="ml-2 text-yellow-200">Waiting for review</span>}
                  {r.status === "declined" && <span className="ml-2 text-gray-400">Not approved</span>}
                  {admin && (r.hidden_by_reports || r.status === "removed") && <span className="ml-2 text-red-300">({r.status === "removed" ? "removed" : "hidden by reports"})</span>}
                </p>
                <p className="mt-2 whitespace-pre-line text-gray-200">{r.body}</p>
                {r.user_id === v.userId ? (
                  <form action={deleteReplyAction} className="mt-2"><input type="hidden" name="id" value={r.id} />
                    <ConfirmButton message="Delete your reply?" className="text-xs text-gray-400 underline hover:text-white">Delete</ConfirmButton></form>
                ) : r.status === "published" && <Report type="reply" id={r.id} postId={post.id} />}
              </li>
            ))}
          </ul>
        )}
        {live ? (
          <div className="mt-8 rounded-2xl border border-white/10 p-6"><ReplyForm action={replyAction.bind(null, post.id)} /></div>
        ) : <p className="mt-8 text-sm text-gray-500">Replies open once the post is live.</p>}
      </section>
      <p className="mt-12 text-xs text-gray-500">Help between members is voluntary. PANA doesn&apos;t vet members or their advice. Email addresses are never shown here.</p>
    </main>
  );
}
