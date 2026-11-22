import { redirect } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { safeNext, TERMS_UPDATED_ON } from "@/lib/gate";
import { getViewer } from "@/lib/members";
import WelcomeForm from "./WelcomeForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const viewer = await getViewer();
  if (viewer.status === "anon") redirect(`/sign-in?redirect_url=${encodeURIComponent(`/welcome?next=${next}`)}`);
  if (viewer.status === "ok" && viewer.termsCurrent) redirect(next);
  if (viewer.status === "banned") redirect("/");

  if (viewer.status === "ok") {
    // Existing member, older Terms version: re-accept once (age was already confirmed).
    return (
      <main className="mx-auto max-w-xl px-6 py-20">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Updated {TERMS_UPDATED_ON}</p>
        <h1 className="mb-3 text-4xl font-bold tracking-tight">We updated our Terms</h1>
        <p className="mb-4 text-gray-400">
          Our Terms of Use and Privacy Policy now cover the PANA incubator, community partners, mentors and events.
          The short version:
        </p>
        <ul className="mb-8 list-disc space-y-2 pl-5 text-sm text-gray-300">
          <li>PANA connects people. Partners and sponsors provide resources directly; PANA doesn&apos;t give out money or equipment.</li>
          <li>Incubator applications are seen only by you and PANA admins.</li>
          <li>Your PANA account is also used by PANA Domino Royale and PANA Sports Connect. Deleting it deletes that data too.</li>
        </ul>
        <p className="mb-6 text-sm text-gray-400">
          Read the full <Link href="/terms" target="_blank" className="text-green-400 underline">Terms of Use</Link> and{" "}
          <Link href="/privacy" target="_blank" className="text-green-400 underline">Privacy Policy</Link>.
        </p>
        <WelcomeForm next={next} mode="update" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Welcome to PANA 2.0</p>
      <h1 className="mb-3 text-4xl font-bold tracking-tight">One quick step</h1>
      <p className="mb-8 text-gray-400">
        PANA 2.0 is a community for adults 18 and older, with a college focus. Please confirm the following to
        submit ideas and take part in the member community.
      </p>
      <WelcomeForm next={next} />
    </main>
  );
}
