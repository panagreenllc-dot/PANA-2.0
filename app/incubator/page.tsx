import Link from "next/link";
import type { Metadata } from "next";
import PageIntro, { CardGrid, btnPrimary, btnSecondary } from "@/components/PageIntro";
import { COHORT_FORMATS, COMMUNITY_WELCOME, decisionText, cohortPhase, PROGRAM_PUBLIC_NAME } from "@/lib/incubator";
import { publicCohorts } from "@/lib/incubator-repo";
import { getViewer } from "@/lib/members";
import sql, { type Row } from "@/lib/db";
import { notifyMeAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Incubator",
  description: "The PANA 2.0 virtual incubator: apply any time, year-round. Guidance, mentorship, and access to resources through community partners.",
};

const SUPPORT = [
  { title: "Guidance", body: "Practical help shaping your idea, planning next steps and avoiding common mistakes." },
  { title: "Mentorship", body: "Connect with experienced builders, operators and founders who have been there." },
  { title: "Community & sponsor support", body: "Local partners and sponsors back projects directly. PANA connects you with them." },
  { title: "Access to tools", body: "Computer lab and library time, software and space through our community partners." },
];

const PATHS = [
  { title: "Bootstrapping", body: "Grow on your own terms, funded by customers and your own resources." },
  { title: "Partnerships", body: "Team up with businesses and organizations that share your goals." },
  { title: "Community-supported projects", body: "Build with and for the community, backed by the people it serves." },
  { title: "Investment", body: "When it fits, get ready to meet mentors and investors." },
];

const formatLabel = (f: string) => COHORT_FORMATS.find((x) => x.value === f)?.label ?? f;

function EnrollmentCard({ open, program }: { open: boolean; program: Row | null }) {
  return (
    <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent p-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">
        {open ? "Open enrollment" : "Applications closed"}
      </p>
      <h2 className="mb-2 text-3xl font-semibold">{PROGRAM_PUBLIC_NAME}</h2>
      <p className="mb-6 max-w-2xl text-gray-300">
        Enrollment is open year-round. Apply any time — 24/7, 365 days a year. We take the time to review your idea
        and what you&apos;re looking for, then email you a decision.
      </p>
      <dl className="mb-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div><dt className="text-gray-500">Format</dt><dd className="font-medium">{formatLabel(String(program?.format ?? "virtual"))}</dd></div>
        <div><dt className="text-gray-500">Applications</dt><dd className="font-medium">{open ? "Open year-round" : "Temporarily closed"}</dd></div>
        <div><dt className="text-gray-500">Decisions</dt><dd className="font-medium">By private email, on a rolling basis</dd></div>
      </dl>
      <p className="mb-6 max-w-2xl text-sm text-gray-400">{decisionText(program ?? {})} {COMMUNITY_WELCOME}</p>
      {open && program ? (
        <Link href={`/incubator/apply?cohort=${program.id}`} className={btnPrimary + " inline-block"}>Apply now</Link>
      ) : (
        <p className="text-sm text-gray-400">Applications are temporarily closed. You can ask to be notified below.</p>
      )}
    </div>
  );
}

export default async function IncubatorPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const [cohorts, viewer] = await Promise.all([publicCohorts().catch(() => [] as Row[]), getViewer().catch(() => null)]);
  const openPrograms = cohorts.filter((c) => cohortPhase(c as never) === "open");
  const anyOpen = openPrograms.length > 0;
  const program = openPrograms[0] ?? cohorts[0] ?? null;
  let wantsNews = false;
  if (viewer?.userId && viewer.status === "ok") {
    const [m] = await sql`SELECT email_prefs FROM members WHERE user_id = ${viewer.userId}`.catch(() => [] as Row[]);
    wantsNews = m?.email_prefs?.incubator_news === true;
  }

  return (
    <main>
      <PageIntro eyebrow="Incubator" title="A virtual incubator to help you build">
        <p>
          The PANA 2.0 incubator is a virtual program, open wherever you are, with open enrollment year-round.
          We help beginners, students, entrepreneurs and developers turn ideas into real projects and businesses,
          with guidance, mentorship and access to resources through community partners.
        </p>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row">
          {anyOpen
            ? <a href="#apply" className={btnPrimary}>Apply now</a>
            : <a href="#notify" className={btnPrimary}>Get notified</a>}
          <Link href="/submit" className={btnSecondary}>Share your idea</Link>
        </div>
      </PageIntro>

      <section id="apply" className="mx-auto max-w-6xl space-y-6 px-6 pt-20">
        <EnrollmentCard open={anyOpen} program={program} />
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-6 text-2xl font-semibold">What the incubator offers</h2>
        <CardGrid items={SUPPORT} cols={4} />
        <p className="mt-6 max-w-3xl text-sm text-gray-500">
          PANA is the platform that connects participants with mentors, community partners and sponsors. Partners
          provide resources directly. PANA itself doesn&apos;t give out money or equipment.
        </p>
        <p className="mt-3 text-sm">
          <Link href="/incubator/resources" className="text-green-400 hover:text-green-300">See partner resources</Link>
          <span className="text-gray-600"> · </span>
          <Link href="/partners" className="text-green-400 hover:text-green-300">Our partners</Link>
          <span className="text-gray-600"> · </span>
          <Link href="/support" className="text-green-400 hover:text-green-300">Become a partner</Link>
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-2 text-2xl font-semibold">More than one path to success</h2>
        <p className="mb-6 max-w-2xl text-gray-400">There is no single right way to build. We support the path that fits you and your project.</p>
        <CardGrid items={PATHS} cols={4} />
      </section>

      <section id="notify" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-white/10 p-8">
          <h2 className="mb-2 text-2xl font-semibold">{anyOpen ? "Incubator news" : "Get notified when applications reopen"}</h2>
          {notice === "notify-on" && <p className="mb-3 text-sm text-green-300">Done. We&apos;ll email you about incubator application news.</p>}
          {notice === "notify-off" && <p className="mb-3 text-sm text-gray-300">You won&apos;t get incubator news emails.</p>}
          <p className="mb-6 max-w-2xl text-gray-400">
            {anyOpen
              ? "Applications are open year-round. You can still opt in to occasional news, for example if applications ever close and reopen. Turn it off any time on My PANA."
              : "Members can ask for one email when applications reopen. You can turn it off any time on My PANA."}
          </p>
          {!viewer?.userId ? (
            <Link href="/sign-up" className={btnPrimary + " inline-block"}>{anyOpen ? "Join PANA to apply" : "Join PANA to get notified"}</Link>
          ) : (
            <form action={notifyMeAction}>
              <input type="hidden" name="on" value={wantsNews ? "off" : "on"} />
              <button className={(wantsNews ? btnSecondary : btnPrimary) + " inline-block"}>
                {wantsNews ? "Stop incubator news" : anyOpen ? "Get incubator news" : "Notify me when applications reopen"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
