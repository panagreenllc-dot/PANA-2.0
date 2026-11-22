import sql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import AdminProjectRow from "@/components/AdminProjectRow";
import AdminNotice from "@/components/AdminNotice";
import ConfirmButton from "@/components/ConfirmButton";
import { approveNeedAction, approveProject, deleteProject, rejectProject, requestChanges, sendBackNeedAction } from "./actions";
import { pendingNeeds } from "@/lib/needs-repo";
import { NEED_KINDS } from "@/lib/needs";
import Link from "next/link";
import { pendingApplications } from "@/lib/incubator-repo";
import { partnerTodo } from "@/lib/partners-repo";

export default async function PendingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  // Auth check must run here, not only in the layout: Next renders layout and page in parallel.
  await requireAdmin();
  const { error } = await searchParams;
  const projects = await sql`
    SELECT p.*, COALESCE(p.email, m.email) AS email FROM projects p LEFT JOIN members m ON m.user_id = p.user_id
    WHERE p.status = 'pending' ORDER BY p.created_at ASC`;

  const apps = await pendingApplications().catch(() => 0);
  const partnerItems = await partnerTodo().catch(() => 0);
  const needs = await pendingNeeds().catch((e) => { console.error("pendingNeeds failed", e); return []; });
  const needKind = (k: string) => NEED_KINDS.find((x) => x.value === k)?.label ?? k;

  return (
    <section>
      <AdminNotice error={error} />
      {apps > 0 && (
        <p className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {apps} new incubator application{apps === 1 ? "" : "s"} waiting. <Link href="/admin/incubator" className="underline">Open the Incubator tab</Link>
        </p>
      )}
      {partnerItems > 0 && (
        <p className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
          {partnerItems} partner item{partnerItems === 1 ? "" : "s"} waiting (inquiries, partners, offers, listing changes or offer requests). <Link href="/admin/partners" className="underline">Open the Partners tab</Link>
        </p>
      )}
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
              <form action={requestChanges} className="flex flex-col gap-1">
                <input type="hidden" name="id" value={String(p.id)} />
                <input type="hidden" name="back" value="/admin" />
                <input name="note" maxLength={500} placeholder="Note to owner (optional)" className="rounded-lg border border-white/10 bg-black px-3 py-2 text-xs text-white" />
                <div className="flex gap-2">
                  <button className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">Request changes</button>
                  <button formAction={rejectProject} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">Reject</button>
                </div>
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

      <h2 id="needs" className="mb-2 mt-12 text-xl font-semibold">Needs waiting for review ({needs.length})</h2>
      <p className="mb-4 text-sm text-gray-400">Approved needs show to whoever can see the idea (never more widely). Needs are for access and help, not money.</p>
      {needs.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-8 text-gray-400">No needs waiting.</p>
      ) : (
        <ul className="space-y-4">
          {needs.map((n) => (
            <li key={n.id} className="rounded-2xl border border-white/10 p-5">
              <p className="text-xs uppercase tracking-wider text-green-400">{needKind(n.kind)}{n.amount_text ? ` · ${n.amount_text}` : ""}</p>
              <p className="font-semibold">{n.title}</p>
              <p className="text-sm text-gray-400">On <Link href={`/ideas/${n.project_id}#needs`} className="underline">{n.project_name}</Link> ({n.idea_status}) · by {n.owner_name}</p>
              {n.details && <p className="mt-2 whitespace-pre-line text-sm text-gray-300">{n.details}</p>}
              <form className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={n.id} />
                <button formAction={approveNeedAction} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400">Approve</button>
                <input name="note" maxLength={500} placeholder="Note to owner (when sending back)" className="min-w-64 flex-1 rounded-lg border border-white/10 bg-black px-3 py-2 text-xs text-white" />
                <button formAction={sendBackNeedAction} className="rounded-lg border border-white/20 px-3 py-2 text-xs font-semibold hover:bg-white/10">Send back</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
