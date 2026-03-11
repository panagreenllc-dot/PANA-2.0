import sql from "../../lib/db";

export default async function ProjectsPage() {
  const projects = await sql`
    SELECT *
    FROM projects
    ORDER BY created_at DESC
  `;

  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <p className="mb-4 text-sm uppercase tracking-[0.35em] text-green-400">
            Projects
          </p>

          <h1 className="mb-6 text-5xl font-bold leading-tight sm:text-6xl">
            Discover what builders are creating
          </h1>

          <p className="mx-auto max-w-3xl text-lg text-gray-300">
            Explore startups, apps, tools, and bold concepts from the PANA 2.0
            community.
          </p>
        </div>

        {projects.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center">
            <h2 className="mb-3 text-2xl font-bold">No projects yet</h2>
            <p className="mb-6 text-gray-300">
              Be the first to submit a project to the PANA ecosystem.
            </p>
            <a
              href="/submit-project"
              className="rounded-2xl bg-green-500 px-6 py-3 font-bold text-black transition hover:bg-green-400"
            >
              Submit a Project
            </a>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project: any) => (
              <div
                key={project.id}
                className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-green-400/40 hover:bg-white/10"
              >
                <div className="mb-4 flex items-center justify-between">
                  <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-300">
                    {project.category}
                  </span>

                  <span className="text-sm text-gray-400">
                    {new Date(project.created_at).toLocaleDateString()}
                  </span>
                </div>

                <h2 className="mb-2 text-2xl font-bold">{project.project_name}</h2>

                <p className="mb-2 text-sm text-gray-400">by {project.name}</p>

                <p className="mb-6 text-gray-300">{project.description}</p>

                {project.website ? (
                  <a
                    href={project.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
                  >
                    Visit Project
                  </a>
                ) : (
                  <a
                    href="/submit-project"
                    className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
                  >
                    Learn More
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}