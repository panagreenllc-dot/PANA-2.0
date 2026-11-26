import Link from "next/link";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { cohortPhase, decisionText, parseUuid, PROGRAM_PUBLIC_NAME } from "@/lib/incubator";
import { applicableIdeas, hasLiveApplication, publicCohorts } from "@/lib/incubator-repo";
import ApplicationForm from "./ApplicationForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Apply to the Incubator", robots: { index: false, follow: false } };

export default async function ApplyPage({ searchParams }: { searchParams: Promise<{ cohort?: string }> }) {
  const { cohort: rawCohort } = await searchParams;
  const wanted = parseUuid(rawCohort);
  const { userId } = await requireMember(`/incubator/apply${wanted ? `?cohort=${wanted}` : ""}`, { currentTerms: true });
  const open = (await publicCohorts()).filter((c) => cohortPhase(c as never) === "open");
  const cohort = open.find((c) => c.id === wanted) ?? open[0];

  const shell = (body: React.ReactNode) => (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Incubator</p>
      {body}
    </main>
  );

  if (!cohort) {
    return shell(<>
      <h1 className="mb-3 text-4xl font-bold tracking-tight">Applications are temporarily closed</h1>
      <p className="mb-6 text-gray-400">Ask to be notified on the Incubator page and we&apos;ll email you when applications reopen.</p>
      <Link href="/incubator#notify" className="text-green-400 underline">Back to the Incubator</Link>
    </>);
  }
  if (await hasLiveApplication(cohort.id, userId)) {
    return shell(<>
      <h1 className="mb-3 text-4xl font-bold tracking-tight">You&apos;ve already applied</h1>
      <p className="mb-6 text-gray-400">Your application to the {PROGRAM_PUBLIC_NAME} is on My PANA, where you can follow its status.</p>
      <Link href="/me#incubator" className="text-green-400 underline">Go to My PANA</Link>
    </>);
  }
  const ideas = await applicableIdeas(userId);
  if (ideas.length === 0) {
    return shell(<>
      <h1 className="mb-3 text-4xl font-bold tracking-tight">First, share your idea</h1>
      <p className="mb-6 text-gray-400">
        You apply to the incubator with one of your ideas. Submit it first (it can still be in review), then come back here.
        Ideas keep their own visibility settings; applying doesn&apos;t make anything public.
      </p>
      <Link href="/submit" className="rounded-xl bg-green-500 px-6 py-3 font-semibold text-black hover:bg-green-400">Submit an idea</Link>
    </>);
  }

  return shell(<>
    <h1 className="mb-3 text-4xl font-bold tracking-tight">Apply to the {PROGRAM_PUBLIC_NAME}</h1>
    <p className="mb-2 text-gray-400">
      Applications are open year-round. {decisionText(cohort)}
    </p>
    <p className="mb-10 text-sm text-gray-500">Only you and PANA admins can see your application.</p>
    <ApplicationForm cohortId={cohort.id} ideas={ideas.map((i) => ({ id: i.id, name: i.project_name, status: i.status, stage: i.stage }))} />
  </>);
}
