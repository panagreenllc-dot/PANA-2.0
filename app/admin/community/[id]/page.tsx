import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import ConfirmButton from "@/components/ConfirmButton";
import FeedPostForm from "@/components/FeedPostForm";
import { adminPost, agendaOf, speakersOf } from "@/lib/community-repo";
import { formatDateTime } from "@/lib/datetime";
import { parseUuid } from "@/lib/incubator";
import { feedStatusAction, updateFeedAction } from "../actions";

const NOTICE: Record<string, string> = {
  created: "Draft saved. Publish it when it's ready.", saved: "Saved.", published: "Published.", archived: "Archived (hidden from the site).",
  draft: "Moved back to draft (hidden from the site).", pin: "Pinned.", unpin: "Unpinned.",
};

export default async function EditFeedPostPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  await requireAdmin();
  const id = parseUuid((await params).id);
  if (!id) notFound();
  const { error, notice } = await searchParams;
  const post = await adminPost(id);
  if (!post) notFound();
  const [agenda, speakers] = await Promise.all([agendaOf(id), speakersOf(id)]);
  const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold";
  const act = (to: string, label: string, cls: string, confirm?: string) => (
    <form action={feedStatusAction}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="to" value={to} />
      {confirm ? <ConfirmButton message={confirm} className={`${btn} ${cls}`}>{label}</ConfirmButton> : <button className={`${btn} ${cls}`}>{label}</button>}
    </form>
  );
  const href = post.program === "techcon" && post.audience === "public" ? "/techcon" : `/events/${post.slug}`;
  return (
    <section>
      <Link href="/admin/community" className="mb-4 inline-block text-sm text-gray-400 hover:text-white">← Community</Link>
      {notice && NOTICE[notice] && <p role="status" className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{NOTICE[notice]}</p>}
      <AdminNotice error={error} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{post.title}</h2>
          <p className="text-xs text-gray-500">{post.kind} · {post.status}{post.pinned ? " · pinned" : ""} · {post.audience === "members" ? "members only" : "public"} · updated {formatDateTime(post.updated_at)}</p>
          {post.status === "published" && <Link href={href} className="text-sm text-green-400 underline">View on the site</Link>}
        </div>
        <div className="flex flex-wrap gap-2">
          {post.status !== "published" && act("published", "Publish", "border-green-500/40 text-green-300 hover:bg-green-500/10", post.audience === "public" ? "Publish this for everyone to see?" : "Publish this for members?")}
          {post.status === "published" && act("draft", "Unpublish", "border-white/20 hover:bg-white/10")}
          {post.status !== "archived" && post.status !== "draft" && act("archived", "Archive", "border-white/20 hover:bg-white/10")}
          {act(post.pinned ? "unpin" : "pin", post.pinned ? "Unpin" : "Pin", "border-white/20 hover:bg-white/10")}
          {post.status === "draft" && act("delete", "Delete draft", "border-red-500/40 text-red-300 hover:bg-red-500/10", "Delete this draft for good?")}
        </div>
      </div>
      <FeedPostForm action={updateFeedAction} post={post} agenda={agenda} speakers={speakers} submit="Save changes" />
    </section>
  );
}
