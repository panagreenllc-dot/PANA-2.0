import Link from "next/link";
import type { Metadata } from "next";
import ConfirmButton from "@/components/ConfirmButton";
import { formatDateTime, formatDay } from "@/lib/datetime";
import { requireMember } from "@/lib/members";
import { badgeDisplayName } from "@/lib/partners";
import { badgesEnabled, myBadge } from "@/lib/partners-repo";
import { newBadgeCodeAction } from "./actions";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My incubator badge", robots: { index: false, follow: false } };

export default async function BadgePage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { userId } = await requireMember("/me/badge", { currentTerms: true });
  const { notice } = await searchParams;
  const badge = badgesEnabled() ? await myBadge(userId) : null;
  const active = !!badge && !badge.revoked_at && badge.app_status === "accepted" && badge.participant_status === "active"
    && (!badge.expires_at || new Date(badge.expires_at) > new Date());

  return (
    <main className="mx-auto max-w-xl px-6 py-12">
      <Link href="/me" className="text-sm text-gray-400 hover:text-white print:hidden">← My PANA</Link>
      <h1 className="mb-6 mt-4 text-3xl font-bold tracking-tight print:hidden">My incubator badge</h1>
      {notice === "new-code" && <p className="mb-4 rounded-lg border border-green-500/40 bg-green-500/10 px-4 py-3 text-sm text-green-200 print:hidden" role="status">New code ready. Your old QR code no longer works.</p>}
      {notice === "error" && <p className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300 print:hidden" role="alert">We couldn&apos;t make a new code. Please try again.</p>}

      {!badgesEnabled() ? (
        <p className="text-gray-400">Badges aren&apos;t switched on yet. Please check back soon.</p>
      ) : !badge ? (
        <div className="space-y-3 text-gray-400">
          <p>Badges are for accepted incubator participants. Once you&apos;re accepted into a cohort, your badge appears here.</p>
          <Link href="/incubator" className="underline hover:text-white">About the incubator</Link>
        </div>
      ) : active && badge.qrSvg ? (
        <>
          <section className="rounded-3xl border-2 border-green-500 bg-white p-6 text-black shadow-xl" aria-label="PANA incubator badge">
            <div className="mb-4 flex items-center gap-2 text-sm font-bold tracking-tight"><span className="inline-block h-2.5 w-2.5 rounded-full bg-green-500" /> PANA 2.0 · Incubator participant</div>
            <p className="text-2xl font-bold">{badgeDisplayName(badge.display_name)}</p>
            <p className="text-sm text-gray-700">{badge.cohort_name}</p>
            {badge.expires_at && <p className="text-sm text-gray-700">Valid through {formatDay(badge.cohort_ends_on)} (ET)</p>}
            <div className="mx-auto my-4 w-64 max-w-full [&_svg]:h-auto [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: badge.qrSvg }} />
            <p className="text-center text-xs text-gray-600">Partner staff: scan to confirm this badge on panagreen.org, then check a photo ID.</p>
          </section>
          <div className="mt-6 flex flex-wrap gap-3 print:hidden">
            <PrintButton />
            <form action={newBadgeCodeAction}>
              <input type="hidden" name="id" value={badge.id} />
              <ConfirmButton message="Make a new code? Your current QR code (and any printed copy) will stop working." className="rounded-xl border border-white/20 px-5 py-2 text-sm font-semibold hover:bg-white/10">Get a new code</ConfirmButton>
            </form>
          </div>
          <ul className="mt-6 list-disc space-y-1 pl-5 text-sm text-gray-400 print:hidden">
            <li>Your badge is personal. Don&apos;t share it. If you think someone else has your code, get a new one.</li>
            <li>A scan shows only that you&apos;re an active participant, your first name and last initial, your cohort and the valid-through date. Never your email.</li>
            <li>Checked {badge.check_count} time{badge.check_count === 1 ? "" : "s"}{badge.last_checked_at ? `, last on ${formatDateTime(badge.last_checked_at)}` : ""}.</li>
            <li><Link href="/incubator/resources" className="underline hover:text-white">See partner offers you can use</Link></li>
          </ul>
        </>
      ) : (
        <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.02] p-6 text-gray-300">
          <p className="font-semibold">Your badge isn&apos;t active.</p>
          <p className="text-sm text-gray-400">
            {badge.revoked_at ? (badge.revoked_by === "system" ? `${badge.revoke_reason}.` : "It was turned off by PANA. If you think this is a mistake, reply to any PANA email.")
              : badge.expires_at && new Date(badge.expires_at) <= new Date() ? "Your cohort has ended." : "You're not an active participant right now."}
          </p>
        </div>
      )}
    </main>
  );
}
