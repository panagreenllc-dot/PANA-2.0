import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import { badgeIsValid } from "@/lib/badge";
import { formatDateTime, formatDay } from "@/lib/datetime";
import { adminBadges, badgesEnabled } from "@/lib/partners-repo";
import { reinstateBadgeAction, revokeBadgeAction } from "../actions";
import Subnav from "../Subnav";

const NOTICES: Record<string, string> = { revoked: "Badge revoked. Its QR code now shows “Not valid”.", reinstated: "Badge reinstated with a new code. The old QR code stays invalid." };

export default async function AdminBadgesPage({ searchParams }: { searchParams: Promise<{ error?: string; notice?: string }> }) {
  await requireAdmin();
  const { error, notice } = await searchParams;
  const badges = await adminBadges();
  return (
    <section>
      <Subnav active="badges" />
      <AdminNotice error={error} />
      {notice && NOTICES[notice] && <p className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200" role="status">{NOTICES[notice]}</p>}
      {!badgesEnabled() && <p className="mb-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">Badges are off: BADGE_TOKEN_SECRET isn&apos;t set for this deployment.</p>}
      <h2 className="mb-2 text-xl font-semibold">Incubator badges ({badges.length})</h2>
      <p className="mb-4 text-xs text-gray-500">Issued automatically when an application is accepted. Completing or leaving the program revokes it. PANA records only how many times a badge was checked and when, never who checked it or where.</p>
      {badges.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-6 text-gray-400">No badges yet.</p> : (
        <ul className="space-y-3">
          {badges.map((b) => {
            const valid = badgeIsValid(b as never);
            return (
              <li key={b.id} className="rounded-2xl border border-white/10 p-5">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{b.display_name || "PANA member"} <span className="text-sm font-normal text-gray-400">· {b.cohort_name}</span></p>
                  <span className={`rounded-full px-2 py-0.5 text-xs ${valid ? "bg-green-500/15 text-green-300" : "bg-red-500/15 text-red-300"}`}>{valid ? "active" : b.revoked_at ? "revoked" : "not valid"}</span>
                </div>
                <p className="text-xs text-gray-500">
                  Issued {formatDateTime(b.issued_at)}{b.cohort_ends_on ? ` · valid through ${formatDay(b.cohort_ends_on)}` : ""} · checked {b.check_count}×{b.last_checked_at ? ` (last ${formatDateTime(b.last_checked_at)})` : ""}
                  {b.revoked_at ? ` · revoked ${formatDateTime(b.revoked_at)}: ${b.revoke_reason}` : ""}
                </p>
                {!b.revoked_at ? (
                  <form action={revokeBadgeAction} className="mt-3 flex flex-wrap gap-2">
                    <input type="hidden" name="id" value={b.id} />
                    <input name="reason" required maxLength={300} placeholder="Reason (required)" className="min-w-64 flex-1 rounded-lg border border-white/10 bg-black px-3 py-1.5 text-xs" />
                    <button className="rounded-lg border border-red-500/40 px-3 py-1.5 text-xs font-semibold text-red-300">Revoke</button>
                  </form>
                ) : b.revoked_by !== "system" && (
                  <form action={reinstateBadgeAction} className="mt-3"><input type="hidden" name="id" value={b.id} />
                    <button className="rounded-lg border border-white/20 px-3 py-1.5 text-xs font-semibold">Reinstate with a new code</button></form>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
