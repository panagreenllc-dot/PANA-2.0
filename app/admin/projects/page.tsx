import Link from "next/link";
import sql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import AdminProjectRow from "@/components/AdminProjectRow";
import AdminNotice from "@/components/AdminNotice";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteProject, unpublishProject } from "../actions";

export default async function ListedProjectsPage({ searchParams }: { searchParams: Promise<{ q?: string; error?: string }> }) {
  await requireAdmin();
  const { q = "", error } = await searchParams;
  const like = `%${q.trim()}%`;
  const projects = await sql`
    SELECT * FROM projects WHERE status = 'approved'
      AND (${q.trim() === ""} OR project_name ILIKE ${like} OR name ILIKE ${like} OR email ILIKE ${like})
    ORDER BY created_at DESC`;

  return (
    <section>
      <AdminNotice error={error} />
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-xl font-semibold">Listed projects ({projects.length})</h2>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search name, owner, email" className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm" />
          <button className="rounded-lg border border-white/20 px-3 py-2 text-sm">Search</button>
        </form>
      </div>
      {projects.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-8 text-gray-400">No listed projects.</p>
      ) : (
        <ul className="space-y-4">
          {projects.map((p) => (
            <AdminProjectRow key={p.id} project={p}>
              <Link href={`/admin/projects/${encodeURIComponent(String(p.id))}`} className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white hover:text-black">Edit</Link>
              <form action={unpublishProject}>
                <input type="hidden" name="id" value={String(p.id)} />
                <input type="hidden" name="back" value="/admin/projects" />
                <button className="rounded-lg border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white/10">Unpublish</button>
              </form>
              <form action={deleteProject}>
                <input type="hidden" name="id" value={String(p.id)} />
                <input type="hidden" name="back" value="/admin/projects" />
                <ConfirmButton message={`Delete "${p.project_name}" permanently?`} className="rounded-lg border border-red-500/40 px-4 py-2 text-sm font-semibold text-red-300 hover:bg-red-500/10">
                  Delete
                </ConfirmButton>
              </form>
            </AdminProjectRow>
          ))}
        </ul>
      )}
    </section>
  );
}
