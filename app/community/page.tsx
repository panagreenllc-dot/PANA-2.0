import Link from "next/link";
import type { Metadata } from "next";
import PageIntro, { CardGrid, btnPrimary, btnSecondary } from "@/components/PageIntro";
import { announcements, upcomingEvents, type FeedPost } from "@/lib/community-repo";
import { formatDate, formatEventRange } from "@/lib/datetime";
import { getViewer } from "@/lib/members";

export const dynamic = "force-dynamic";

const eventHref = (e: FeedPost) => (e.program === "techcon" && e.audience === "public" ? "/techcon" : `/events/${e.slug}`);

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

export default async function CommunityPage() {
  const v = await getViewer().catch(() => null);
  const member = v?.status === "ok";
  const [events, news] = await Promise.all([upcomingEvents(member).catch(() => [] as FeedPost[]), announcements(member).catch(() => [] as FeedPost[])]);
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

      <section className="mx-auto grid max-w-6xl gap-10 px-6 pt-20 lg:grid-cols-2">
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Upcoming events</h2>
          {events.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-8 text-gray-400">No upcoming events yet.</p> : (
            <ul className="space-y-3">
              {events.map((e) => {
                const w = formatEventRange(e.starts_at, e.ends_at);
                return (
                  <li key={e.id}>
                    <Link href={eventHref(e)} className="block rounded-2xl border border-white/10 p-5 transition hover:border-green-400/40">
                      <p className="text-xs font-semibold uppercase tracking-wider text-green-400">{w.day}{e.audience === "members" ? " · Members only" : ""}</p>
                      <p className="mt-1 text-lg font-semibold">{e.title}</p>
                      <p className="text-sm text-gray-400">{w.time}{e.location_name ? ` · ${e.location_name}` : e.is_online ? " · Online" : ""}</p>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div>
          <h2 className="mb-4 text-2xl font-semibold">Announcements</h2>
          {news.length === 0 ? <p className="rounded-2xl border border-dashed border-white/15 p-8 text-gray-400">No announcements yet.</p> : (
            <ul className="space-y-3">
              {news.map((n) => (
                <li key={n.id}>
                  <Link href={`/events/${n.slug}`} className="block rounded-2xl border border-white/10 p-5 transition hover:border-green-400/40">
                    <p className="text-xs text-gray-500">{n.pinned ? "Pinned · " : ""}{formatDate(n.published_at)}{n.audience === "members" ? " · Members only" : ""}</p>
                    <p className="mt-1 text-lg font-semibold">{n.title}</p>
                    {n.body && <p className="mt-1 line-clamp-2 text-sm text-gray-400">{n.body}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-sm text-gray-400">Get these by email about twice a month: turn on the community digest in <Link href="/me#email" className="text-green-400 underline">My PANA</Link>.</p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pt-16">
        <div className="rounded-2xl border border-green-500/30 bg-gradient-to-br from-green-500/10 to-transparent p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Members only</p>
          <h2 className="mb-2 text-2xl font-semibold">Community board: members supporting each other</h2>
          <p className="mb-6 max-w-2xl text-gray-400">
            Ask a question, look for a hand, share a win or pass on a tip. Reply to help each other. The PANA team reviews each member&apos;s
            first post, and members can report anything that breaks the rules. Contact details stay private.
          </p>
          <Link href="/community/board" className={btnPrimary + " inline-block"}>Open the community board</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-6 text-2xl font-semibold">Who&apos;s here</h2>
        <CardGrid items={WHO} />
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-6 pb-24 md:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 to-transparent p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Members only</p>
          <h2 className="mb-2 text-2xl font-semibold">Member profiles</h2>
          <p className="mb-6 text-gray-400">
            Share your skills, interests and what you&apos;re looking for, and find collaborators. Profiles are private
            until you publish them, and visible to signed-in members only.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/members" className={btnPrimary}>Browse members</Link>
            <Link href="/me/profile" className={btnSecondary}>Create your profile</Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">Looking for guidance? <Link href="/mentors" className="text-green-400 underline">Find a volunteer mentor</Link>, or <Link href="/me/profile#mentor" className="text-green-400 underline">apply to mentor</Link>.</p>
        </div>
        <div className="rounded-2xl border border-white/10 p-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Membership</p>
          <h2 className="mb-2 text-2xl font-semibold">18+ and college-focused</h2>
          <p className="text-gray-400">
            PANA 2.0 membership is open to adults 18 and older, with a focus on college students and early-career
            builders, alongside entrepreneurs, mentors and professionals.
          </p>
        </div>
        <div className="rounded-2xl border border-white/10 p-8 md:col-span-2">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Community partners</p>
          <h2 className="mb-2 text-2xl font-semibold">Colleges, libraries and local businesses</h2>
          <p className="mb-6 max-w-2xl text-gray-400">
            Partners open their doors with lab hours, library time, meeting space and mentoring for incubator participants.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/partners" className={btnSecondary}>Meet our partners</Link>
            <Link href="/support" className={btnSecondary}>Become a partner</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
