import Link from "next/link";
import type { Metadata } from "next";
import { PostForm } from "@/components/BoardForms";
import { board, myPosts } from "@/lib/community-repo";
import { kindLabel, POST_KINDS } from "@/lib/community";
import { formatDate } from "@/lib/datetime";
import { requireMember } from "@/lib/members";
import { createPostAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Community board", robots: { index: false, follow: false } };

const PAGE = 20;
const STATUS: Record<string, string> = { pending: "Waiting for review", declined: "Not approved", published: "Live" };

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ kind?: string; page?: string; notice?: string }> }) {
  const sp = await searchParams;
  const kind = POST_KINDS.some((k) => k.value === sp.kind) ? sp.kind! : null;
  const page = Math.max(1, Math.min(50, Number(sp.page) || 1));
  const v = await requireMember(`/community/board${kind ? `?kind=${kind}` : ""}`, { currentTerms: true });
  const [posts, mine] = await Promise.all([board(kind, PAGE, (page - 1) * PAGE), myPosts(v.userId)]);
  const total = posts[0]?.total ?? 0;
  const waiting = mine.filter((p) => p.status !== "published");
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? "border-green-500 bg-green-500/15 text-green-200" : "border-white/15 text-gray-300 hover:bg-white/10"}`;

  return (
    <main className="mx-auto max-w-5xl px-6 py-20">
      <Link href="/community" className="mb-4 inline-block text-sm text-gray-400 hover:text-white">← Community</Link>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Members only</p>
      <h1 className="text-4xl font-bold tracking-tight">Community board</h1>
      <p className="mt-3 max-w-2xl text-gray-400">
        Members supporting each other: ask questions, look for a hand, share wins and tips, and reply to help. Only signed-in members can see
        the board. Your email is never shown. The PANA team reviews each member&apos;s first post or reply; after that, yours appear straight away.
        Please keep it respectful and leave out contact details and money amounts. Report anything that breaks the rules.
      </p>
      {sp.notice === "deleted" && <p role="status" className="mt-4 text-sm text-green-300">Your post was deleted.</p>}

      <section className="mt-10 rounded-2xl border border-white/10 p-6">
        <h2 className="mb-4 text-xl font-semibold">New post</h2>
        <PostForm action={createPostAction} />
      </section>

      {waiting.length > 0 && (
        <section className="mt-8 rounded-2xl border border-yellow-500/20 p-6">
          <h2 className="mb-3 text-lg font-semibold">Your posts not on the board yet</h2>
          <ul className="space-y-2 text-sm">
            {waiting.map((p) => <li key={p.id}><Link href={`/community/board/${p.id}`} className="hover:text-green-300">{p.title}</Link> <span className="text-gray-500">· {STATUS[p.status] ?? p.status}</span></li>)}
          </ul>
        </section>
      )}

      <nav className="mt-10 flex flex-wrap gap-2" aria-label="Filter posts">
        <Link href="/community/board" className={chip(!kind)} aria-current={!kind ? "page" : undefined}>All</Link>
        {POST_KINDS.map((k) => <Link key={k.value} href={`/community/board?kind=${k.value}`} className={chip(kind === k.value)} aria-current={kind === k.value ? "page" : undefined}>{k.label}</Link>)}
      </nav>

      {posts.length === 0 ? (
        <p className="mt-8 rounded-2xl border border-dashed border-white/15 p-12 text-center text-gray-400">{kind ? "Nothing here yet." : "No posts yet. Start the conversation!"}</p>
      ) : (
        <ul className="mt-8 divide-y divide-white/10 rounded-2xl border border-white/10">
          {posts.map((p) => (
            <li key={p.id}>
              <Link href={`/community/board/${p.id}`} className="block p-5 transition hover:bg-white/[0.03]">
                <p className="text-xs uppercase tracking-wider text-green-400">{kindLabel(p.kind)}</p>
                <p className="mt-1 text-lg font-semibold">{p.title}</p>
                <p className="mt-1 line-clamp-2 text-sm text-gray-400">{p.body}</p>
                <p className="mt-2 text-xs text-gray-500">{p.author_name} · {formatDate(p.created_at)} · {p.reply_count} {p.reply_count === 1 ? "reply" : "replies"}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {total > PAGE && (
        <div className="mt-6 flex gap-3 text-sm">
          {page > 1 && <Link href={`/community/board?${kind ? `kind=${kind}&` : ""}page=${page - 1}`} className="text-green-400 underline">← Newer</Link>}
          {page * PAGE < total && <Link href={`/community/board?${kind ? `kind=${kind}&` : ""}page=${page + 1}`} className="text-green-400 underline">Older →</Link>}
        </div>
      )}
    </main>
  );
}
