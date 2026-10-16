import Link from "next/link";
import type { Metadata } from "next";
import PageIntro, { CardGrid, btnPrimary, btnSecondary } from "@/components/PageIntro";
import { CONTACT_EMAIL } from "@/lib/site";

export const metadata: Metadata = {
  title: "Incubator",
  description: "The PANA 2.0 virtual incubator: guidance, mentorship, financial assistance and tools to help builders succeed.",
};

const SUPPORT = [
  { title: "Guidance", body: "Practical help shaping your idea, planning next steps and avoiding common mistakes." },
  { title: "Mentorship", body: "Connect with experienced builders, operators and founders who have been there." },
  { title: "Financial assistance", body: "Support to help promising projects get off the ground." },
  { title: "Tools & equipment", body: "Access to what you need to build, such as computers and equipment." },
];

const PATHS = [
  { title: "Bootstrapping", body: "Grow on your own terms, funded by customers and your own resources." },
  { title: "Partnerships", body: "Team up with businesses and organizations that share your goals." },
  { title: "Community-supported projects", body: "Build with and for the community, backed by the people it serves." },
  { title: "Investment", body: "When it fits, get ready to meet mentors and investors." },
];

const mailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("PANA 2.0 Incubator: notify me")}`;

export default function IncubatorPage() {
  return (
    <main>
      <PageIntro eyebrow="Incubator" title="A virtual incubator to help you build">
        <p>
          The PANA 2.0 incubator starts as a virtual program, open wherever you are. We help beginners, students,
          entrepreneurs and developers turn ideas into real projects and businesses.
        </p>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row">
          <a href={mailto} className={btnPrimary}>Get notified</a>
          <Link href="/submit" className={btnSecondary}>Share your idea</Link>
        </div>
      </PageIntro>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-6 text-2xl font-semibold">What the incubator offers</h2>
        <CardGrid items={SUPPORT} cols={4} />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-2 text-2xl font-semibold">More than one path to success</h2>
        <p className="mb-6 max-w-2xl text-gray-400">There is no single right way to build. We support the path that fits you and your project.</p>
        <CardGrid items={PATHS} cols={4} />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 to-transparent p-8">
          <h2 className="mb-2 text-2xl font-semibold">Applications are coming soon</h2>
          <p className="mb-6 max-w-2xl text-gray-400">
            We&apos;re preparing the first incubator program. Email us to get notified when applications open, or
            share your idea now so the community can see what you&apos;re building.
          </p>
          <a href={mailto} className={btnPrimary + " inline-block"}>Email {CONTACT_EMAIL}</a>
        </div>
      </section>
    </main>
  );
}
