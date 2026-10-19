import Link from "next/link";
import type { Metadata } from "next";
import { getViewerCtx, requireMember } from "@/lib/members";
import { listDirectory } from "@/lib/profiles-repo";
import { LOOKING_FOR, ROLES } from "@/lib/profile-input";
import { toProfileView } from "@/lib/visibility";
import { ProfileCard } from "@/components/ProfileView";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Members", robots: { index: false, follow: false } };

const PAGE = 24;

export default async function MembersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireMember("/members");
  const { ctx } = await getViewerCtx();
  const sp = await searchParams;
  const role = ROLES.some((r) => r.value === sp.role) ? sp.role : undefined;
  const looking = LOOKING_FOR.some((r) => r.value === sp.looking) ? sp.looking : undefined;
  const q = (sp.q ?? "").slice(0, 60);
  const page = Math.max(1, Number(sp.page) || 1);
  const { rows, total } = await listDirectory({ role, looking, q, limit: PAGE, offset: (page - 1) * PAGE });
  const views = rows.map((r) => toProfileView(ctx, r)).filter((v) => v !== null);
  const pages = Math.max(1, Math.ceil(total / PAGE));
  const sel = "rounded-lg border border-white/10 bg-black px-3 py-2 text-sm";
  const qs = (p: number) => `/members?${new URLSearchParams({ ...(role && { role }), ...(looking && { looking }), ...(q && { q }), page: String(p) })}`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Members</p>
          <h1 className="text-4xl font-bold tracking-tight">Find collaborators</h1>
          <p className="mt-3 max-w-xl text-gray-400">Published member profiles, visible only to signed-in members.</p>
        </div>
        <Link href="/me/profile" className="shrink-0 rounded-xl bg-green-500 px-5 py-3 font-semibold text-black transition hover:bg-green-400">My profile</Link>
      </div>

      <form className="mb-8 flex flex-col gap-2 sm:flex-row">
        <input name="q" defaultValue={q} maxLength={60} placeholder="Search name, skill or interest" className={`${sel} flex-1`} />
        <select name="role" defaultValue={role ?? ""} className={sel}>
          <option value="">Any role</option>
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <select name="looking" defaultValue={looking ?? ""} className={sel}>
          <option value="">Looking for anything</option>
          {LOOKING_FOR.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        <button className="rounded-lg border border-white/20 px-4 py-2 text-sm">Filter</button>
      </form>

      {views.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-gray-400">
          No published profiles match yet. <Link href="/me/profile" className="text-green-400">Publish yours</Link>.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">{views.map((v) => <ProfileCard key={v.user_id} p={v} />)}</div>
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
