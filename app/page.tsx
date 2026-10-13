import Link from "next/link";
import sql, { type Row } from "@/lib/db";
import ProjectCard from "@/components/ProjectCard";

export const dynamic = "force-dynamic";

async function latestProjects(): Promise<Row[]> {
  try {
    return await sql`
      SELECT * FROM projects WHERE status = 'approved'
      ORDER BY created_at DESC LIMIT 3`;
  } catch {
    return [];
  }
}

export default async function Home() {
  const projects = await latestProjects();

  return (
    <main>
      <section className="mx-auto max-w-4xl px-6 pb-20 pt-28 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">
          Treasure Coast · Florida
        </p>
        <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
          Where local builders launch what&apos;s next
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-lg text-gray-400">
          A community for founders and creators to share projects, find
          collaborators, and meet at PANA Tech Con.
        </p>
        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/sign-up" className="rounded-xl bg-green-500 px-6 py-3 font-semibold text-black transition hover:bg-green-400">
            Join now
          </Link>
          <Link href="/projects" className="rounded-xl border border-white/20 px-6 py-3 font-semibold transition hover:bg-white hover:text-black">
            Explore projects
          </Link>
        </div>
      </section>

      {projects.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="mb-6 flex items-end justify-between">
            <h2 className="text-2xl font-semibold">Latest projects</h2>
            <Link href="/projects" className="text-sm text-green-400 hover:text-green-300">
              View all →
            </Link>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl border border-white/10 bg-gradient-to-br from-green-500/10 to-transparent p-8 sm:flex-row sm:items-center">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">PANA Tech Con</p>
            <h2 className="text-2xl font-semibold">Talks, demos and pitches on the Treasure Coast</h2>
          </div>
          <Link href="/techcon" className="shrink-0 rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold transition hover:bg-white hover:text-black">
            Event details
          </Link>
        </div>
      </section>
    </main>
  );
}
