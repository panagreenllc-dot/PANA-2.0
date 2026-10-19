import Link from "next/link";
import sql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import ConfirmButton from "@/components/ConfirmButton";
import { REPORT_REASONS } from "@/lib/profile-input";
import { hideIdea, hideProfile, resolveReport, restoreIdea, unhideProfile } from "../moderation-actions";

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const reports = await sql`
    SELECT r.id, r.target_type, r.target_id, r.reason, r.details, r.created_at,
           p.display_name, p.moderation, p.hidden_reason, p.is_published,
           pr.project_name, pr.hidden_by_reports, pr.status AS idea_status,
           (SELECT count(*)::int FROM reports r2 WHERE r2.target_type = r.target_type AND r2.target_id = r.target_id AND r2.status = 'open') AS open_count
    FROM reports r LEFT JOIN profiles p ON r.target_type = 'profile' AND p.user_id = r.target_id
    LEFT JOIN projects pr ON r.target_type = 'idea' AND pr.id::text = r.target_id
    WHERE r.status = 'open' ORDER BY r.created_at ASC LIMIT 200`;
  const reasonLabel = (v: string) => REPORT_REASONS.find((r) => r.value === v)?.label ?? v;
  const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold";

  return (
    <section>
      <AdminNotice error={error} />
      <h2 className="mb-4 text-xl font-semibold">Open reports ({reports.length})</h2>
      {reports.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/15 p-10 text-center text-gray-400">No open reports.</p>
      ) : (
        <ul className="space-y-4">
          {reports.map((r) => (
            <li key={r.id} className="rounded-2xl border border-white/10 p-5">
              <div className="flex flex-col justify-between gap-4 sm:flex-row">
                <div>
                  <p className="text-xs uppercase tracking-wider text-gray-500">{r.target_type} · {new Date(r.created_at).toLocaleString()} · {r.open_count} open</p>
                  <p className="mt-1 font-semibold">
                    {r.target_type === "profile" ? (
                      <Link href={`/members/${r.target_id}`} className="underline">{r.display_name ?? r.target_id}</Link>
                    ) : r.target_type === "idea" ? (
                      <Link href={`/ideas/${r.target_id}`} className="underline">{r.project_name ?? r.target_id}</Link>
                    ) : r.target_id}
                    {r.hidden_by_reports && <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">hidden</span>}
                    {r.moderation === "hidden" && <span className="ml-2 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">hidden{r.hidden_reason ? `: ${r.hidden_reason}` : ""}</span>}
                  </p>
                  <p className="mt-1 text-sm text-red-300">{reasonLabel(r.reason)}</p>
                  {r.details && <p className="mt-1 max-w-xl whitespace-pre-line text-sm text-gray-400">{r.details}</p>}
                </div>
                <div className="flex flex-wrap items-start gap-2">
                  {r.target_type === "profile" && r.moderation === "ok" && (
                    <form action={hideProfile}>
                      <input type="hidden" name="back" value="/admin/reports" />
                      <input type="hidden" name="userId" value={r.target_id} />
                      <input type="hidden" name="note" value={`Report: ${reasonLabel(r.reason)}`} />
                      <ConfirmButton message="Hide this profile from members?" className={`${btn} border-red-500/40 text-red-300 hover:bg-red-500/10`}>Hide profile</ConfirmButton>
                    </form>
                  )}
                  {r.target_type === "profile" && r.moderation === "hidden" && (
                    <form action={unhideProfile}>
                      <input type="hidden" name="back" value="/admin/reports" />
                      <input type="hidden" name="userId" value={r.target_id} />
                      <ConfirmButton message="Restore this profile and dismiss its open reports?" className={`${btn} border-white/20 hover:bg-white/10`}>Restore &amp; dismiss all</ConfirmButton>
                    </form>
                  )}
                  {r.target_type === "idea" && r.project_name && !r.hidden_by_reports && (
                    <form action={hideIdea}>
                      <input type="hidden" name="back" value="/admin/reports" />
                      <input type="hidden" name="ideaId" value={r.target_id} />
                      <input type="hidden" name="note" value={`Report: ${reasonLabel(r.reason)}`} />
                      <ConfirmButton message="Hide this idea from everyone except its owner?" className={`${btn} border-red-500/40 text-red-300 hover:bg-red-500/10`}>Hide idea</ConfirmButton>
                    </form>
                  )}
                  {r.target_type === "idea" && r.hidden_by_reports && (
                    <form action={restoreIdea}>
                      <input type="hidden" name="back" value="/admin/reports" />
                      <input type="hidden" name="ideaId" value={r.target_id} />
                      <ConfirmButton message="Restore this idea and dismiss its open reports?" className={`${btn} border-white/20 hover:bg-white/10`}>Restore &amp; dismiss all</ConfirmButton>
                    </form>
                  )}
                  <form action={resolveReport}>
                    <input type="hidden" name="back" value="/admin/reports" />
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="resolution" value="dismissed" />
                    <button className={`${btn} border-white/20 hover:bg-white/10`}>Dismiss</button>
                  </form>
                  <form action={resolveReport}>
                    <input type="hidden" name="back" value="/admin/reports" />
                    <input type="hidden" name="reportId" value={r.id} />
                    <input type="hidden" name="resolution" value="actioned" />
                    <button className={`${btn} border-green-500/40 text-green-300 hover:bg-green-500/10`}>Mark handled</button>
                  </form>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
