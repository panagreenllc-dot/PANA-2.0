import Link from "next/link";
import sql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import ConfirmButton from "@/components/ConfirmButton";
import { hideProfile, unhideProfile, unpublishProfile } from "../moderation-actions";

export default async function AdminProfilesPage({ searchParams }: { searchParams: Promise<{ error?: string; q?: string; filter?: string }> }) {
  await requireAdmin();
  const { error, q = "", filter = "all" } = await searchParams;
  const like = `%${q.trim().slice(0, 60).replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
  const f = ["published", "hidden", "private"].includes(filter) ? filter : "all";
  const rows = await sql`
    SELECT p.user_id, p.display_name, p.headline, p.is_published, p.moderation, p.hidden_reason, p.updated_at, m.status AS member_status,
           (SELECT count(*)::int FROM reports r WHERE r.target_type = 'profile' AND r.target_id = p.user_id AND r.status = 'open') AS open_reports
    FROM profiles p JOIN members m ON m.user_id = p.user_id
    WHERE (${q.trim() === ""} OR p.display_name ILIKE ${like} OR p.headline ILIKE ${like})
      AND (${f} = 'all' OR (${f} = 'published' AND p.is_published AND p.moderation = 'ok')
           OR (${f} = 'hidden' AND p.moderation = 'hidden') OR (${f} = 'private' AND NOT p.is_published))
    ORDER BY p.updated_at DESC LIMIT 200`;
  const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold";

  return (
    <section>
      <AdminNotice error={error} />
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-xl font-semibold">Profiles ({rows.length})</h2>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search name or headline" className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm" />
          <select name="filter" defaultValue={f} className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm">
            <option value="all">All</option><option value="published">Published</option><option value="hidden">Hidden</option><option value="private">Private</option>
          </select>
          <button className="rounded-lg border border-white/20 px-3 py-2 text-sm">Filter</button>
        </form>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-gray-400">
            <tr><th className="px-4 py-3">Member</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Reports</th><th className="px-4 py-3 text-right">Actions</th></tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {rows.map((p) => (
              <tr key={p.user_id}>
                <td className="px-4 py-3">
                  <Link href={`/members/${p.user_id}`} className="font-medium underline">{p.display_name}</Link>
                  {p.headline && <p className="text-gray-400">{p.headline}</p>}
                </td>
                <td className="px-4 py-3 space-x-1">
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{p.is_published ? "published" : "private"}</span>
                  {p.moderation === "hidden" && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300" title={p.hidden_reason ?? ""}>hidden</span>}
                  {p.member_status !== "active" && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">{p.member_status}</span>}
                </td>
                <td className="px-4 py-3">{p.open_reports}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap justify-end gap-2">
                    {p.moderation === "ok" ? (
                      <form action={hideProfile}>
                        <input type="hidden" name="back" value="/admin/profiles" />
                        <input type="hidden" name="userId" value={p.user_id} />
                        <ConfirmButton message={`Hide ${p.display_name}'s profile from members?`} className={`${btn} border-red-500/40 text-red-300 hover:bg-red-500/10`}>Hide</ConfirmButton>
                      </form>
                    ) : (
                      <form action={unhideProfile}>
                        <input type="hidden" name="back" value="/admin/profiles" />
                        <input type="hidden" name="userId" value={p.user_id} />
                        <ConfirmButton message="Restore this profile and dismiss its open reports?" className={`${btn} border-white/20 hover:bg-white/10`}>Restore</ConfirmButton>
                      </form>
                    )}
                    {p.is_published && (
                      <form action={unpublishProfile}>
                        <input type="hidden" name="back" value="/admin/profiles" />
                        <input type="hidden" name="userId" value={p.user_id} />
                        <ConfirmButton message={`Unpublish ${p.display_name}'s profile? They can publish it again.`} className={`${btn} border-white/20 hover:bg-white/10`}>Unpublish</ConfirmButton>
                      </form>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
