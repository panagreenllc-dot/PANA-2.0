import Link from "next/link";
import { browseIdeas } from "@/lib/ideas-repo";
import { toIdeaView, type ViewerCtx } from "@/lib/visibility";

const ANON: ViewerCtx = { userId: null, status: "anon", isAdmin: false };
import ProjectCard from "@/components/ProjectCard";
import { CardGrid, btnPrimary, btnSecondary } from "@/components/PageIntro";

export const dynamic = "force-dynamic";

async function latestIdeas() {
  try {
    const { rows } = await browseIdeas(false, { limit: 3 }); // homepage: public ideas only
    return rows.map((r) => ({ v: toIdeaView(ANON, r), by: r.name })).filter((x) => x.v);
  } catch {
    return [];
  }
}

const PILLARS = [
  { href: "/ideas", eyebrow: "Explore Ideas", title: "Discover what the community is building", body: "Browse ideas, startups and projects shared by members, and find something to support or join." },
  { href: "/incubator", eyebrow: "Incubator", title: "A virtual incubator for builders", body: "Guidance, mentorship, financial assistance and the tools you need, like computers and equipment, to turn an idea into reality." },
  { href: "/community", eyebrow: "Community", title: "Developers, founders, creators, mentors", body: "Starting on the Treasure Coast, with an online community open to everyone. Find collaborators and learn together." },
];

const AUDIENCE = [
  { title: "Beginners", body: "Never built anything before? Start here with guidance and people who will help." },
  { title: "Students", body: "Put your skills to work on real projects and meet people who can open doors." },
  { title: "Entrepreneurs", body: "Validate your idea, find a team and get support to launch." },
  { title: "Developers", body: "Join projects, build your portfolio and collaborate with founders." },
];

export default async function Home() {
  const ideas = await latestIdeas();

  return (
    <main>
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-28 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">
          PANA 2.0 · Community-powered innovation
        </p>
        <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Where Community Meets Innovation.
        </h1>
        <p className="mx-auto mb-10 max-w-2xl text-lg text-gray-400">
          PANA 2.0 is a community-powered innovation ecosystem connecting developers, entrepreneurs,
          creators, mentors, and investors. Share your ideas, discover projects, find collaborators, and
          access the resources to turn innovation into reality.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/submit" className={btnPrimary}>Share Your Idea</Link>
          <Link href="/community" className={btnSecondary}>Explore the Community</Link>
          <Link href="/incubator" className={btnSecondary}>Discover the Incubator</Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 md:grid-cols-3">
          {PILLARS.map((p) => (
            <Link key={p.href} href={p.href} className="group rounded-2xl border border-white/10 bg-white/[0.02] p-6 transition hover:border-green-400/40">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">{p.eyebrow}</p>
              <h2 className="mb-2 text-lg font-semibold">{p.title}</h2>
              <p className="text-sm text-gray-400">{p.body}</p>
              <span className="mt-4 inline-block text-sm text-green-400 group-hover:text-green-300">Learn more →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-6 text-2xl font-semibold">Built for every kind of builder</h2>
        <CardGrid items={AUDIENCE} cols={4} />
      </section>

      {ideas.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Latest ideas</h2>
            <Link href="/ideas" className="text-sm text-green-400 hover:text-green-300">
              Explore all →
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {ideas.map((x) => (
              <ProjectCard key={x.v!.id} project={x.v!} by={x.by} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 to-transparent p-8 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Program · Treasure Coast Tech Con</p>
            <h2 className="mb-2 text-2xl font-semibold">Talks, demos and pitches. February 21, 2027 in Fort Pierce</h2>
            <p className="max-w-xl text-sm text-gray-400">
              Our flagship in-person event brings the community together to showcase projects and meet mentors and investors.
            </p>
          </div>
          <Link href="/techcon" className="shrink-0 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold transition hover:bg-white hover:text-black">
            Event details
          </Link>
        </div>
      </section>
    </main>
  );
}
