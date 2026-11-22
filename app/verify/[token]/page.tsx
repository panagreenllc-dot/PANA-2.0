import type { Metadata } from "next";
import { headers } from "next/headers";
import { badgeIsValid, TOKEN_RE } from "@/lib/badge";
import { formatDateTime, formatDay } from "@/lib/datetime";
import { badgeDisplayName } from "@/lib/partners";
import { badgesEnabled, verifyToken } from "@/lib/partners-repo";
import { clientIp, hit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "PANA badge check", robots: { index: false, follow: false } };

/** Public QR target. Shows the minimum; unknown, expired and revoked codes all look the same ("Not valid"). */
export default async function VerifyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const ip = clientIp(await headers());
  const limited = !hit("verify", ip, 30, 60_000);
  const row = !limited && badgesEnabled() && TOKEN_RE.test(token) ? await verifyToken(token).catch(() => null) : null;
  const valid = badgeIsValid(row as never);
  const checkedAt = formatDateTime(new Date());

  return (
    <main className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center">
      <p className="mb-6 text-sm font-semibold tracking-tight text-gray-400"><span className="mr-2 inline-block h-2.5 w-2.5 rounded-full bg-green-400" />PANA 2.0 badge check</p>
      {limited ? (
        <div className="w-full rounded-3xl border border-yellow-500/50 bg-yellow-500/10 p-8">
          <p className="text-xl font-semibold">Too many checks</p>
          <p className="mt-2 text-sm text-gray-300">Please wait a minute and scan again.</p>
        </div>
      ) : valid && row ? (
        <div className="w-full rounded-3xl border-2 border-green-500 bg-green-500/10 p-8" role="status">
          <p className="text-5xl" aria-hidden="true">✅</p>
          <p className="mt-3 text-2xl font-bold text-green-300">Active PANA incubator participant</p>
          <p className="mt-6 text-3xl font-bold">{badgeDisplayName(row.display_name)}</p>
          <p className="mt-2 text-gray-300">{row.cohort_name}</p>
          {row.expires_at && <p className="text-gray-300">Valid through {formatDay(row.cohort_ends_on)} (ET)</p>}
          <p className="mt-6 rounded-xl bg-black/40 p-3 text-sm text-gray-200">Check a photo ID to confirm the name.</p>
        </div>
      ) : (
        <div className="w-full rounded-3xl border-2 border-red-500 bg-red-500/10 p-8" role="status">
          <p className="text-5xl" aria-hidden="true">⛔</p>
          <p className="mt-3 text-2xl font-bold text-red-300">Not valid</p>
          <p className="mt-2 text-sm text-gray-300">This badge isn&apos;t active. Please don&apos;t grant participant-only access with it.</p>
        </div>
      )}
      <p className="mt-6 text-xs text-gray-500">Checked {checkedAt}. PANA shows only what a partner needs to know.</p>
    </main>
  );
}
