import Link from "next/link";
import type { Metadata } from "next";
import sql from "@/lib/db";
import ProjectCard from "@/components/ProjectCard";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Explore Ideas" };

export default async function IdeasPage() {
  const projects = await sql`
    SELECT id, name, project_name, category, description, website, created_at FROM projects
    WHERE status = 'approved'
    ORDER BY created_at DESC`;

  return (
    <main className="mx-auto max-w-6xl px-6 py-20">
      <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Explore Ideas</p>
          <h1 className="text-4xl font-bold tracking-tight">Ideas and projects from the community</h1>
          <p className="mt-3 max-w-xl text-gray-400">
            Ideas, startups, apps and tools shared by PANA members. Find something to support, join or learn from. Every listing is reviewed by our team.
          </p>
        </div>
        <Link href="/submit" className="shrink-0 rounded-xl bg-green-500 px-5 py-3 font-semibold text-black transition hover:bg-green-400">
          Submit an idea
        </Link>
      </div>

      {projects.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/15 p-12 text-center text-gray-400">
          Nothing listed yet. Be the first to share an idea.
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </main>
  );
}
