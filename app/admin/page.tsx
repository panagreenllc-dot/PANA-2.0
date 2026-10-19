import sql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import AdminProjectRow from "@/components/AdminProjectRow";
import AdminNotice from "@/components/AdminNotice";
import ConfirmButton from "@/components/ConfirmButton";
import { approveProject, deleteProject } from "./actions";

export default async function PendingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Auth check must run here, not only in the layout: Next renders layout and page in parallel.
  await requireAdmin();
  const { error } = await searchParams;
  const projects = await sql`
    SELECT p.*, COALESCE(p.email, m.email) AS email FROM projects p LEFT JOIN members m ON m.user_id = p.user_id
    WHERE p.status = 'pending' ORDER BY p.created_at ASC`;

  return (
    <section>
      <AdminNotice error={error} />
      <h2 className="mb-4 text-xl font-semibold">Pending review ({projects.length})</h2>
      {projects.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-8 text-gray-400">Nothing waiting for review.</p>
      ) : (
        <ul className="space-y-4">
          {projects.map((p) => (
            <AdminProjectRow key={p.id} project={p}>
              <form action={approveProject}>
                <input type="hidden" name="id" value={String(p.id)} />
                <input type="hidden" name="back" value="/admin" />
                <button className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400">Approve</button>
              </form>
              <form action={deleteProject}>
                <input type="hidden" name="id" value={String(p.id)} />
                <input type="hidden" name="back" value="/admin" />
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
