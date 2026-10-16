import Link from "next/link";
import type { Metadata } from "next";
import PageIntro, { CardGrid, btnPrimary, btnSecondary } from "@/components/PageIntro";

export const metadata: Metadata = {
  title: "Community",
  description: "Join the PANA 2.0 community of developers, entrepreneurs, creators, mentors and investors.",
};

const WHO = [
  { title: "Developers", body: "Join projects, sharpen your skills and build a portfolio that matters." },
  { title: "Entrepreneurs", body: "Find co-founders, test ideas and get support to launch." },
  { title: "Students", body: "Get real-world experience and connect with people who can help you grow." },
  { title: "Creators", body: "Designers, writers and makers who bring ideas to life." },
  { title: "Mentors", body: "Share what you know and help the next generation of builders." },
  { title: "Investors", body: "Discover promising projects and founders early." },
];

export default function CommunityPage() {
  return (
    <main>
      <PageIntro eyebrow="Community" title="Find your people. Build together.">
        <p>
          PANA 2.0 starts on Florida&apos;s Treasure Coast, with an online community open to everyone. Share
          ideas, find collaborators, and learn from people at every stage, from first-time builders to experienced founders.
        </p>
        <div className="flex flex-col gap-3 pt-4 sm:flex-row">
          <Link href="/sign-up" className={btnPrimary}>Join the community</Link>
          <Link href="/ideas" className={btnSecondary}>Explore ideas</Link>
        </div>
      </PageIntro>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-6 text-2xl font-semibold">Who&apos;s here</h2>
        <CardGrid items={WHO} />
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 to-transparent p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Coming soon</p>
          <h2 className="mb-2 text-2xl font-semibold">Member profiles</h2>
          <p className="text-gray-400">
            Soon you&apos;ll be able to share your skills, interests and what you&apos;re looking for, and find
            collaborators. Profiles will be visible to signed-in members only.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Membership</p>
          <h2 className="mb-2 text-2xl font-semibold">18+ and college-focused</h2>
          <p className="text-gray-400">
            PANA 2.0 membership is open to adults 18 and older, with a focus on college students and early-career
            builders, alongside entrepreneurs, mentors and professionals.
          </p>
        </div>
      </section>
    </main>
  );
}
