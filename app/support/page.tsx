import Link from "next/link";
import type { Metadata } from "next";
import PageIntro, { CardGrid, btnSecondary } from "@/components/PageIntro";
import InquiryForm from "./InquiryForm";
import { publicOpenNeeds } from "@/lib/needs-repo";
import { NEED_KINDS } from "@/lib/needs";

// Reads live needs; never prerendered at build time (and never fails the page if the query does).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Support PANA projects · Become a partner",
  description: "Local colleges, libraries, businesses and sponsors help PANA builders with access to labs, computers, mentorship, software and space. PANA connects you with them.",
};

const WAYS = [
  { title: "Lab & computer access", body: "Open your computer lab or reserve library computer time for incubator participants, on your schedule." },
  { title: "Mentorship hours", body: "Give a few hours a month to help builders plan, design, code or launch." },
  { title: "Software & credits", body: "Share software licenses or cloud credits your organization can offer." },
  { title: "Meeting & work space", body: "A room on Fridays, a desk for a weekend hackathon, a place for a demo night." },
  { title: "Sponsor a project directly", body: "Back a project you believe in. You support the participant directly; PANA never handles the money." },
  { title: "Events", body: "Help with Treasure Coast Tech Con and community build nights." },
];

export default async function SupportPage() {
  const needs = await publicOpenNeeds(6).catch((e) => { console.error("publicOpenNeeds failed", e); return []; });
  const kind = (k: string) => NEED_KINDS.find((x) => x.value === k)?.label ?? k;
  return (
    <main>
      <PageIntro eyebrow="Support PANA projects" title="Become a community partner">
        <p>PANA is the platform that connects local builders with the people and organizations who can help. Partners provide access directly. PANA gives no grants, money or equipment.</p>
        <p>Incubator participants carry a PANA badge, so your staff can confirm who is in the program with a quick scan.</p>
      </PageIntro>
      <section className="mx-auto max-w-6xl px-6 py-16">
        <h2 className="mb-8 text-2xl font-semibold">Ways to help</h2>
        <CardGrid items={WAYS} />
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/partners" className={btnSecondary}>See our partners</Link>
          <Link href="/incubator" className={btnSecondary}>About the incubator</Link>
        </div>
      </section>
      {needs.length > 0 && (
        <section id="open-needs" className="mx-auto max-w-6xl px-6 pb-16">
          <h2 className="mb-2 text-2xl font-semibold">What builders need right now</h2>
          <p className="mb-6 text-gray-400">Open needs on public ideas, reviewed by PANA. Members can offer help from each idea&apos;s page; organizations can tell us below.</p>
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {needs.map((n) => (
              <li key={n.id}>
                <Link href={`/ideas/${n.project_id}#needs`} className="block h-full rounded-2xl border border-white/10 p-5 hover:border-green-500/50">
                  <p className="text-xs uppercase tracking-wider text-green-400">{kind(n.kind)}{n.amount_text ? ` · ${n.amount_text}` : ""}</p>
                  <p className="mt-1 font-medium">{n.title}</p>
                  <p className="mt-2 text-sm text-gray-400">For &ldquo;{n.project_name}&rdquo;</p>
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/ideas?needs=1" className="mt-6 inline-block text-sm text-green-400 underline">See all ideas with open needs</Link>
        </section>
      )}
      <section id="partner-form" className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-2 text-2xl font-semibold">Tell us how you&apos;d like to help</h2>
        <p className="mb-6 text-gray-400">No account needed. John from PANA reads every message and replies by email. Every partner listing and offer is reviewed before it appears on the site.</p>
        <InquiryForm />
      </section>
    </main>
  );
}
