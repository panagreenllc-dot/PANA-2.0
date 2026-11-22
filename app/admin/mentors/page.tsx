import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import ConfirmButton from "@/components/ConfirmButton";
import { formatDateTime } from "@/lib/datetime";
import { EXPERTISE, INVESTOR_TYPES, label, ROLE_STATUS_LABEL } from "@/lib/mentors";
import { STAGES } from "@/lib/ideas";
import { adminDecided, adminPending, type RoleRow } from "@/lib/mentors-repo";
import { decideRoleAction } from "./actions";

export const dynamic = "force-dynamic";

const DONE: Record<string, string> = {
  "mentor-approve": "Mentor approved. They've been emailed and now appear in the mentor directory.",
  "mentor-decline": "Mentor application declined. They've been emailed.",
  "mentor-revoke": "Mentor badge removed. They've been emailed.",
  "investor-approve": "Investor approved. They've been emailed.",
  "investor-decline": "Investor application declined. They've been emailed.",
  "investor-revoke": "Investor badge removed. They've been emailed.",
};
const tag = (r: RoleRow, t: string) => r.role === "mentor" ? label(EXPERTISE, t) : label(STAGES, t);
const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold";
const inp = "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder:text-gray-500";

function Hidden({ r }: { r: RoleRow }) {
  return <><input type="hidden" name="role" value={r.role} /><input type="hidden" name="userId" value={r.user_id} /></>;
}

function Card({ r, children }: { r: RoleRow; children?: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-white/10 p-5">
      <p className="text-xs uppercase tracking-wider text-gray-500">
        {r.role === "mentor" ? "Mentor" : "Investor"} · {ROLE_STATUS_LABEL[r.status] ?? r.status} · updated {formatDateTime(r.updated_at)}
      </p>
      <p className="mt-1 font-semibold"><Link href={`/members/${r.user_id}`} className="underline">{r.name}</Link>
        {r.role === "investor" && <span className="ml-2 text-sm font-normal text-gray-400">{label(INVESTOR_TYPES, r.detail ?? "")}{r.organization ? ` · ${r.organization}` : ""}</span>}
        {r.role === "mentor" && r.detail && <span className="ml-2 text-sm font-normal text-gray-400">Availability: {r.detail}</span>}
      </p>
      {r.tags?.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{r.tags.map((t) => <span key={t} className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-gray-300">{tag(r, t)}</span>)}</div>}
      <p className="mt-3 max-w-2xl whitespace-pre-line text-sm text-gray-300">{r.bio}</p>
      {r.review_note && <p className="mt-2 text-xs text-gray-500">Last note: {r.review_note}</p>}
      {children}
    </li>
  );
}

export default async function MentorsAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; done?: string }> }) {
  await requireAdmin();
  const { error, done } = await searchParams;
  const [pending, decided] = await Promise.all([adminPending(), adminDecided()]);
  const active = decided.filter((r) => r.status === "approved" || r.status === "paused");
  const past = decided.filter((r) => r.status === "declined" || r.status === "revoked");

  return (
    <section className="space-y-10">
      <AdminNotice error={error} />
      {done && DONE[done] && <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{DONE[done]}</p>}
      <p className="text-sm text-gray-400">Approving gives the member a PANA mentor or investor badge. Approved mentors appear in the members-only
        mentor directory. Investors are never listed; they can only send interest to ideas whose owners turned it on. PANA doesn&apos;t vet anyone
        or take part in any deal, and every email says so.</p>

      <div id="pending">
        <h2 className="mb-4 text-xl font-semibold">Waiting for review ({pending.length})</h2>
        {pending.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-gray-400">No applications waiting.</p> : (
          <ul className="space-y-4">
            {pending.map((r) => (
              <Card key={`${r.role}-${r.user_id}`} r={r}>
                <form action={decideRoleAction} className="mt-4 space-y-2">
                  <Hidden r={r} />
                  <input name="note" maxLength={500} placeholder="Note to the member (optional; included in their email)" className={inp} />
                  <div className="flex flex-wrap gap-2">
                    <button name="decision" value="approve" className={`${btn} border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20`}>Approve</button>
                    <button name="decision" value="decline" className={`${btn} border-white/20 text-gray-300 hover:bg-white/10`}>Decline</button>
                  </div>
                </form>
              </Card>
            ))}
          </ul>
        )}
      </div>

      <div id="approved">
        <h2 className="mb-4 text-xl font-semibold">Approved ({active.length})</h2>
        {active.length === 0 ? <p className="text-gray-500">Nobody approved yet.</p> : (
          <ul className="space-y-4">
            {active.map((r) => (
              <Card key={`${r.role}-${r.user_id}`} r={r}>
                <details className="mt-3">
                  <summary className="cursor-pointer text-xs text-red-300">Remove badge…</summary>
                  <form action={decideRoleAction} className="mt-2 space-y-2">
                    <Hidden r={r} /><input type="hidden" name="decision" value="revoke" />
                    <input name="note" required maxLength={500} placeholder="Reason (required; included in their email)" className={inp} />
                    <ConfirmButton message="Remove this badge? The member is emailed and can't re-apply on their own." className={`${btn} border-red-500/40 text-red-300 hover:bg-red-500/10`}>Remove badge</ConfirmButton>
                  </form>
                </details>
              </Card>
            ))}
          </ul>
        )}
      </div>

      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer text-lg font-semibold">Declined or removed ({past.length})</summary>
          <ul className="mt-4 space-y-4">
            {past.map((r) => (
              <Card key={`${r.role}-${r.user_id}`} r={r}>
                <form action={decideRoleAction} className="mt-3 flex flex-wrap gap-2">
                  <Hidden r={r} /><input type="hidden" name="decision" value="approve" />
                  <input name="note" maxLength={500} placeholder="Note (optional)" className={`${inp} max-w-md`} />
                  <ConfirmButton message="Approve this member now?" className={`${btn} border-green-500/40 text-green-300 hover:bg-green-500/10`}>Approve</ConfirmButton>
                </form>
              </Card>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
