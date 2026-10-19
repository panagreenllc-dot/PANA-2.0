import Link from "next/link";
import type { Metadata } from "next";
import ProjectCard from "@/components/ProjectCard";
import { getViewerCtx } from "@/lib/members";
import { browseIdeas } from "@/lib/ideas-repo";
import { CATEGORIES, HELP_NEEDED, KINDS, STAGES } from "@/lib/ideas";
import { isGatedMember, toIdeaView } from "@/lib/visibility";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore Ideas" };
const PAGE = 24;

export default async function IdeasPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { ctx } = await getViewerCtx();
  const gated = isGatedMember(ctx);
  const pick = (v: string | undefined, list: readonly string[]) => (v && list.includes(v) ? v : undefined);
  const f = {
    category: pick(sp.category, CATEGORIES),
    kind: pick(sp.kind, KINDS.map((k) => k.value)),
    stage: pick(sp.stage, STAGES.map((k) => k.value)),
    help: pick(sp.help, HELP_NEEDED.map((k) => k.value)),
    q: (sp.q ?? "").slice(0, 80),
  };
  const page = Math.max(1, Number(sp.page) || 1);
  let rows: Awaited<ReturnType<typeof browseIdeas>>["rows"] = [];
  let total = 0;
  try {
    ({ rows, total } = await browseIdeas(gated, { ...f, limit: PAGE, offset: (page - 1) * PAGE }));
  } catch (e) {
    console.error("browseIdeas failed", e);
  }
  const ideas = rows.map((r) => ({ v: toIdeaView(ctx, r), by: r.name, members: r.audience === "members" })).filter((x) => x.v);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const sel = "rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white";
  const qs = (p: number) => `/ideas?${new URLSearchParams({ ...Object.fromEntries(Object.entries(f).filter(([, v]) => v)), page: String(p) } as Record<string, string>)}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Explore Ideas</p>
          <h1 className="text-4xl font-bold tracking-tight">Ideas and projects from the community</h1>
          <p className="mt-3 max-w-xl text-gray-400">
            Ideas, startups, apps and tools shared by PANA members. Find something to support, join or learn from. Every listing is reviewed by our team.
            {!gated && <> <Link href="/sign-up" className="text-green-400">Join</Link> to see members-only ideas.</>}
          </p>
        </div>
        <Link href="/submit" className="shrink-0 rounded-xl bg-green-500 px-5 py-3 font-semibold text-black transition hover:bg-green-400">Submit an idea</Link>
      </div>

      <form className="mb-8 grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
        <input name="q" defaultValue={f.q} maxLength={80} placeholder="Search ideas" className={`${sel} lg:col-span-2`} />
        <select name="category" defaultValue={f.category ?? ""} className={sel}><option value="">Any category</option>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
        <select name="kind" defaultValue={f.kind ?? ""} className={sel}><option value="">Any type</option>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
        <select name="stage" defaultValue={f.stage ?? ""} className={sel}><option value="">Any stage</option>{STAGES.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
        <div className="flex gap-2">
          <select name="help" defaultValue={f.help ?? ""} className={`${sel} flex-1`}><option value="">Any help</option>{HELP_NEEDED.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          <button className="rounded-lg border border-white/20 px-4 py-2 text-sm">Filter</button>
        </div>
      </form>

      {ideas.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-gray-400">
          {Object.values(f).some(Boolean) ? "No ideas match these filters." : "Nothing listed yet. Be the first to share an idea."}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {ideas.map((x) => <ProjectCard key={x.v!.id} project={x.v!} by={x.by} membersOnly={x.members} />)}
        </div>
      )}
      {pages > 1 && (
        <nav className="mt-10 flex justify-center gap-4 text-sm">
          {page > 1 && <Link href={qs(page - 1)} className="text-green-400">← Previous</Link>}
          <span className="text-gray-500">Page {page} of {pages}</span>
          {page < pages && <Link href={qs(page + 1)} className="text-green-400">Next →</Link>}
        </nav>
      )}
    </main>
  );
}
