import Link from "next/link";
import type { Metadata } from "next";
import PageIntro, { CardGrid, btnPrimary, btnSecondary } from "@/components/PageIntro";
import { formatDateTime, formatDay } from "@/lib/datetime";
import { cohortPhase, COHORT_FORMATS } from "@/lib/incubator";
import { publicCohorts } from "@/lib/incubator-repo";
import { getViewer } from "@/lib/members";
import sql, { type Row } from "@/lib/db";
import { notifyMeAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Incubator",
  description: "The PANA 2.0 virtual incubator: guidance, mentorship, and access to resources through community partners.",
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

function CohortCard({ c }: { c: Row }) {
  const phase = cohortPhase(c as never);
  const label = { open: "Applications open", upcoming: "Opening soon", closed: "Applications closed", running: "In progress" }[phase as string] ?? "";
  return (
    <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent p-8">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">{label}</p>
      <h2 className="mb-2 text-3xl font-semibold">{c.name}</h2>
      {c.summary && <p className="mb-6 max-w-2xl whitespace-pre-line text-gray-300">{c.summary}</p>}
      <dl className="mb-6 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <div><dt className="text-gray-500">Format</dt><dd className="font-medium">{formatLabel(c.format)} · {c.capacity} spots</dd></div>
        <div><dt className="text-gray-500">Applications</dt><dd className="font-medium">
          {c.apply_opens_at ? `${formatDateTime(c.apply_opens_at)} – ` : "Until "}{formatDateTime(c.apply_closes_at)}
        </dd></div>
        {(c.starts_on || c.ends_on) && <div><dt className="text-gray-500">Program</dt><dd className="font-medium">{formatDay(c.starts_on)}{c.ends_on ? ` – ${formatDay(c.ends_on)}` : ""}</dd></div>}
        {(c.announce_on || c.announce_note) && <div><dt className="text-gray-500">Decisions</dt><dd className="font-medium">{c.announce_note}{c.announce_on ? ` · ${formatDay(c.announce_on)}` : ""}</dd></div>}
      </dl>
      {phase === "open" ? (
        <Link href={`/incubator/apply?cohort=${c.id}`} className={btnPrimary + " inline-block"}>Apply now</Link>
      ) : phase === "upcoming" ? (
        <p className="text-sm text-gray-400">Applications open {formatDateTime(c.apply_opens_at)}.</p>
      ) : null}
    </div>
  );
}

export default async function IncubatorPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  const { notice } = await searchParams;
  const [cohorts, viewer] = await Promise.all([publicCohorts().catch(() => [] as Row[]), getViewer().catch(() => null)]);
  const anyOpen = cohorts.some((c) => cohortPhase(c as never) === "open");
  let wantsNews = false;
  if (viewer?.userId && viewer.status === "ok") {
    const [m] = await sql`SELECT email_prefs FROM members WHERE user_id = ${viewer.userId}`.catch(() => [] as Row[]);
    wantsNews = m?.email_prefs?.incubator_news === true;
  }

  return (
    <main>
      <PageIntro eyebrow="Incubator" title="A virtual incubator to help you build">
        <p>
          The PANA 2.0 incubator starts as a virtual program, open wherever you are. We help beginners, students,
          entrepreneurs and developers turn ideas into real projects and businesses, with guidance, mentorship and
          access to resources through community partners.
        </p>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row">
          {anyOpen
            ? <a href="#cohorts" className={btnPrimary}>See the open cohort</a>
            : <a href="#notify" className={btnPrimary}>Get notified</a>}
          <Link href="/submit" className={btnSecondary}>Share your idea</Link>
        </div>
      </PageIntro>

      {cohorts.length > 0 && (
        <section id="cohorts" className="mx-auto max-w-6xl space-y-6 px-6 pt-20">
          {cohorts.map((c) => <CohortCard key={c.id} c={c} />)}
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-6 text-2xl font-semibold">What the incubator offers</h2>
        <CardGrid items={SUPPORT} cols={4} />
        <p className="mt-6 max-w-3xl text-sm text-gray-500">
          PANA is the platform that connects participants with mentors, community partners and sponsors. Partners
          provide resources directly. PANA itself doesn&apos;t give out money or equipment.
        </p>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-2 text-2xl font-semibold">More than one path to success</h2>
        <p className="mb-6 max-w-2xl text-gray-400">There is no single right way to build. We support the path that fits you and your project.</p>
        <CardGrid items={PATHS} cols={4} />
      </section>

      <section id="notify" className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-white/10 p-8">
          <h2 className="mb-2 text-2xl font-semibold">{anyOpen ? "Hear about future cohorts" : "Applications open soon"}</h2>
          {notice === "notify-on" && <p className="mb-3 text-sm text-green-300">Done. We&apos;ll email you when applications open.</p>}
          {notice === "notify-off" && <p className="mb-3 text-sm text-gray-300">You won&apos;t get incubator news emails.</p>}
          <p className="mb-6 max-w-2xl text-gray-400">
            Members can ask for one email when a cohort opens for applications. You can turn it off any time on My PANA.
          </p>
          {!viewer?.userId ? (
            <Link href="/sign-up" className={btnPrimary + " inline-block"}>Join PANA to get notified</Link>
          ) : (
            <form action={notifyMeAction}>
              <input type="hidden" name="on" value={wantsNews ? "off" : "on"} />
              <button className={(wantsNews ? btnSecondary : btnPrimary) + " inline-block"}>
                {wantsNews ? "Stop incubator news" : "Notify me when applications open"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
