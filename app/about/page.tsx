import Link from "next/link";
import type { Metadata } from "next";
import PageIntro, { CardGrid, btnPrimary, btnSecondary } from "@/components/PageIntro";

export const metadata: Metadata = {
  title: "About PANA",
  description: "About PANA 2.0: a community-driven startup incubator and innovation ecosystem.",
};

const VALUES = [
  { title: "Community first", body: "Innovation grows faster when people share ideas, skills and opportunities." },
  { title: "Access for everyone", body: "Guidance, mentorship and tools shouldn't depend on who you already know." },
  { title: "Many paths", body: "Bootstrapping, partnerships, community-supported projects or investment: we back the path that fits." },
];

export default function AboutPage() {
  return (
    <main>
      <PageIntro eyebrow="About PANA" title="Where Community Meets Innovation.">
        <p>
          PANA 2.0 is a community-driven startup incubator and innovation ecosystem. Through PANA Green, we connect
          developers, entrepreneurs, creators, mentors and investors, and give builders the resources to turn
          ideas into reality.
        </p>
        <p>
          We&apos;re starting on Florida&apos;s Treasure Coast, with an online community open to everyone. Our virtual
          incubator offers guidance, mentorship, financial assistance and tools, and our flagship event,{" "}
          <Link href="/techcon" className="text-green-400 hover:text-green-300">Treasure Coast Tech Con</Link>, brings
          the community together in person.
        </p>
      </PageIntro>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-6 text-2xl font-semibold">What we believe</h2>
        <CardGrid items={VALUES} />
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="rounded-2xl border border-white/10 p-8">
          <h2 className="mb-2 text-2xl font-semibold">Who can join</h2>
          <p className="mb-6 max-w-2xl text-gray-400">
            Membership is open to adults 18 and older, with a college focus. Beginners, students, entrepreneurs and
            developers are all welcome.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/sign-up" className={btnPrimary}>Join now</Link>
            <Link href="/incubator" className={btnSecondary}>Discover the Incubator</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
