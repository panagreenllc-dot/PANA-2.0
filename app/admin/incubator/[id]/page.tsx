import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import CohortForm from "@/components/CohortForm";
import { formatDateTime, formatDay } from "@/lib/datetime";
import { APP_STATUS_LABEL, canDecide, cohortPhase, NEEDS, parseUuid } from "@/lib/incubator";
import { adminQueue, getCohort, notifyCount } from "@/lib/incubator-repo";
import { STAGES } from "@/lib/ideas";
import { adminNoteAction, cohortStatusAction, decideAction, notifyInterestedAction, participantAction, updateCohortAction } from "../actions";

const NOTICES: Record<string, string> = {
  created: "Cohort created.", saved: "Cohort saved.", participant: "Participant updated.", note: "Private note saved.",
  "decided-under_review": "Marked as in review.", "decided-accepted": "Accepted.", "decided-waitlisted": "Waitlisted.", "decided-declined": "Declined.",
};
const EMAIL_NOTE: Record<string, string> = {
  sent: "The applicant was emailed.", skipped: "No email was sent (test address, or the member turned off incubator emails).",
  failed: "The email failed to send; the decision is saved and shows on their My PANA.",
};
const needLabel = (v: string) => NEEDS.find((n) => n.value === v)?.label ?? v;
const stageLabel = (v: string) => STAGES.find((s) => s.value === v)?.label ?? v;
const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold";

export default async function AdminCohortPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; notice?: string; email?: string; sent?: string; skipped?: string; open?: string }>;
}) {
  await requireAdmin();
  const id = parseUuid((await params).id);
  if (!id) notFound();
  const sp = await searchParams;
  const [cohort, apps, waiting] = await Promise.all([getCohort(id), adminQueue(id), notifyCount()]);
  if (!cohort) notFound();
  const phase = cohortPhase(cohort as never);
  const accepted = apps.filter((a) => a.status === "accepted").length;
  const notice = sp.notice === "notified" ? `Sent ${sp.sent ?? 0} "applications are open" emails (${sp.skipped ?? 0} not sent).`
    : sp.notice?.startsWith("status-") ? `Status changed to ${sp.notice.slice(7)}.` : sp.notice ? NOTICES[sp.notice] : undefined;

  return (
    <section className="space-y-8">
      <Link href="/admin/incubator" className="text-sm text-gray-400 hover:text-white">← All cohorts</Link>
      <AdminNotice error={sp.error} />
      {notice && <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{notice}{sp.email && EMAIL_NOTE[sp.email] ? ` ${EMAIL_NOTE[sp.email]}` : ""}</p>}

      <div className="rounded-2xl border border-white/10 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">{cohort.name}</h2>
            <p className="text-sm text-gray-400">
              {cohort.status} · public view: <strong>{phase}</strong> · {accepted}/{cohort.capacity} accepted
            </p>
            <p className="text-sm text-gray-400">
              Applications {formatDateTime(cohort.apply_opens_at) || "(no open time)"} – {formatDateTime(cohort.apply_closes_at) || "(no close time)"}
              {cohort.starts_on ? ` · Program ${formatDay(cohort.starts_on)} – ${formatDay(cohort.ends_on)}` : ""}
              {cohort.announce_on ? ` · Decisions ${formatDay(cohort.announce_on)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["draft", "open", "closed", "active", "completed"] as const).filter((s) => s !== cohort.status).map((s) => (
              <form key={s} action={cohortStatusAction}>
                <input type="hidden" name="id" value={cohort.id} /><input type="hidden" name="status" value={s} />
                <button className={`${btn} ${s === "open" ? "border-green-500/50 text-green-300" : "border-white/20"}`}>
                  {{ draft: "Back to draft", open: "Open applications", closed: "Close applications", active: "Start program", completed: "Mark completed" }[s]}
                </button>
              </form>
            ))}
          </div>
        </div>
        {cohort.status === "open" && (
          <div className="mt-4 border-t border-white/10 pt-4 text-sm text-gray-400">
            {cohort.notified_at ? `"Notify me" members were emailed ${formatDateTime(cohort.notified_at)}.` : (
              <form action={notifyInterestedAction} className="flex flex-wrap items-center gap-3">
                <input type="hidden" name="id" value={cohort.id} />
                <span>{waiting} member{waiting === 1 ? "" : "s"} asked to hear when applications open (up to 90 emails are sent, once per cohort).</span>
                <button disabled={waiting === 0} className={`${btn} border-green-500/50 text-green-300 disabled:opacity-40`}>Email them now</button>
              </form>
            )}
          </div>
        )}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-300">Edit cohort details</summary>
          <div className="mt-4"><CohortForm action={updateCohortAction} cohort={cohort} submitLabel="Save cohort" /></div>
        </details>
      </div>

      <div>
        <h3 className="mb-4 text-xl font-semibold">Applications ({apps.length})</h3>
        {apps.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-8 text-gray-400">No applications yet.</p> : (
          <ul className="space-y-4">
            {apps.map((a) => (
              <li key={a.id} className="rounded-2xl border border-white/10 p-5">
                <details open={sp.open === a.id || a.status === "submitted" || a.status === "under_review"}>
                  <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
                    <span>
                      <span className="font-semibold">{a.applicant_name}</span>
                      <span className="text-sm text-gray-400"> · {a.project_name ?? "(idea removed)"} · {formatDateTime(a.created_at)}</span>
                    </span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs">{APP_STATUS_LABEL[a.status] ?? a.status}{a.participant_status ? ` · ${a.participant_status}` : ""}</span>
                  </summary>
                  <div className="mt-4 grid gap-4 text-sm lg:grid-cols-2">
                    <div className="space-y-2 text-gray-300">
                      <p className="flex flex-wrap gap-3 text-xs text-gray-400">
                        {a.profile_visible ? <Link href={`/members/${a.user_id}`} className="underline">Profile</Link> : <span>Profile not published</span>}
                        {a.project_id && <Link href={`/ideas/${a.project_id}`} className="underline">Idea ({a.project_status})</Link>}
                        <span>Stage: {stageLabel(a.stage)}</span><span>{a.weekly_hours} hrs/week</span>
                      </p>
                      <p className="whitespace-pre-line">{a.goals}</p>
                      {a.needs?.length > 0 && <p className="text-xs text-gray-400">Needs: {a.needs.map(needLabel).join(", ")}</p>}
                      {a.team && <p className="whitespace-pre-line text-xs text-gray-400">Team: {a.team}</p>}
                      {a.links?.main && <p className="text-xs"><a href={a.links.main} target="_blank" rel="noopener noreferrer nofollow" className="text-green-400 underline">{a.links.main}</a></p>}
                      {a.decision_note && <p className="text-xs text-gray-400">Note sent to applicant: {a.decision_note}</p>}
                      {a.reviewed_at && <p className="text-xs text-gray-500">Last decision {formatDateTime(a.reviewed_at)}</p>}
                    </div>
                    <div className="space-y-3">
                      {(["under_review", "accepted", "waitlisted", "declined"] as const).some((d) => canDecide(a.status, d)) && (
                        <form action={decideAction} className="space-y-2">
                          <input type="hidden" name="id" value={a.id} /><input type="hidden" name="cohort_id" value={cohort.id} />
                          <textarea name="note" maxLength={1000} rows={2} placeholder="Note to the applicant (optional, included in their email)" className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-xs text-white" />
                          <textarea name="admin_note" maxLength={2000} rows={2} defaultValue={a.admin_note ?? ""} placeholder="Private admin note (never shown to the applicant)" className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-xs text-white" />
                          {accepted >= cohort.capacity && canDecide(a.status, "accepted") && (
                            <label className="flex items-center gap-2 text-xs text-yellow-200"><input type="checkbox" name="over_capacity" className="accent-yellow-400" /> Cohort is full: accept over capacity</label>
                          )}
                          <div className="flex flex-wrap gap-2">
                            {canDecide(a.status, "accepted") && <button name="decision" value="accepted" className={`${btn} border-green-500/50 bg-green-500 text-black`}>Accept</button>}
                            {canDecide(a.status, "waitlisted") && <button name="decision" value="waitlisted" className={`${btn} border-white/20`}>Waitlist</button>}
                            {canDecide(a.status, "declined") && <button name="decision" value="declined" className={`${btn} border-red-500/40 text-red-300`}>Decline</button>}
                            {canDecide(a.status, "under_review") && <button name="decision" value="under_review" className={`${btn} border-white/20 text-gray-300`}>Mark in review (no email)</button>}
                          </div>
                        </form>
                      )}
                      {a.status === "accepted" && (
                        <form action={participantAction} className="flex flex-wrap items-center gap-2">
                          <input type="hidden" name="id" value={a.id} /><input type="hidden" name="cohort_id" value={cohort.id} />
                          <select name="participant_status" defaultValue={a.participant_status ?? "active"} className="rounded-lg border border-white/10 bg-black px-2 py-1 text-xs">
                            <option value="active">Active participant</option><option value="completed">Completed</option><option value="left">Left the program</option>
                          </select>
                          <button className={`${btn} border-white/20`}>Update</button>
                        </form>
                      )}
                      {!(["under_review", "accepted", "waitlisted", "declined"] as const).some((d) => canDecide(a.status, d)) && (
                        <form action={adminNoteAction} className="space-y-2">
                          <input type="hidden" name="id" value={a.id} /><input type="hidden" name="cohort_id" value={cohort.id} />
                          <textarea name="admin_note" maxLength={2000} rows={2} defaultValue={a.admin_note ?? ""} placeholder="Private admin note" className="w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-xs text-white" />
                          <button className={`${btn} border-white/20`}>Save note</button>
                        </form>
                      )}
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
