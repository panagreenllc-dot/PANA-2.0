import Link from "next/link";
import type { Metadata } from "next";
import PageIntro, { CardGrid, btnSecondary } from "@/components/PageIntro";
import InquiryForm from "./InquiryForm";

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

export default function SupportPage() {
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
      <section id="partner-form" className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-2 text-2xl font-semibold">Tell us how you&apos;d like to help</h2>
        <p className="mb-6 text-gray-400">No account needed. John from PANA reads every message and replies by email. Every partner listing and offer is reviewed before it appears on the site.</p>
        <InquiryForm />
      </section>
    </main>
  );
}
