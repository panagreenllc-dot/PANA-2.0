export default function ProjectsPage() {
  const projects = [
    {
      name: "PANA AI Builder",
      category: "AI Tools",
      description:
        "A platform concept for helping founders turn ideas into launch-ready tech products.",
      stage: "Concept",
    },
    {
      name: "TechCon Connect",
      category: "Event Tech",
      description:
        "An event networking experience designed to help builders, investors, and attendees connect faster.",
      stage: "Prototype",
    },
    {
      name: "Founder Launch Board",
      category: "Startup Tools",
      description:
        "A discovery board where startups can showcase what they are building and attract support.",
      stage: "Early Stage",
    },
    {
      name: "Cyber Shield Hub",
      category: "Cybersecurity",
      description:
        "A community-focused security knowledge platform for builders and small teams.",
      stage: "Idea",
    },
    {
      name: "Creator Pitch Space",
      category: "Community",
      description:
        "A place for creators and innovators to submit projects and get visibility inside the PANA ecosystem.",
      stage: "Concept",
    },
    {
      name: "Dev Match Network",
      category: "Networking",
      description:
        "A platform idea for matching developers, founders, and collaborators based on project needs.",
      stage: "Prototype",
    },
  ];

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
            community. This is where innovation becomes visible.
          </p>
        </div>

        <div className="mb-10 flex flex-wrap justify-center gap-3">
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            AI
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            Startups
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            Cybersecurity
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            Community
          </span>
          <span className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300">
            Event Tech
          </span>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <div
              key={project.name}
              className="rounded-3xl border border-white/10 bg-white/5 p-6 transition hover:border-green-400/40 hover:bg-white/10"
            >
              <div className="mb-4 flex items-center justify-between">
                <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-green-300">
                  {project.category}
                </span>

                <span className="text-sm text-gray-400">{project.stage}</span>
              </div>

              <h2 className="mb-3 text-2xl font-bold">{project.name}</h2>

              <p className="mb-6 text-gray-300">{project.description}</p>

              <a
                href="/submit-project"
                className="inline-flex rounded-xl border border-white/15 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white hover:text-black"
              >
                Learn More
              </a>
            </div>
          ))}
        </div>

        <div className="mt-16 text-center">
          <h2 className="mb-4 text-3xl font-bold">Want your project featured?</h2>
          <p className="mx-auto mb-8 max-w-2xl text-gray-300">
            Submit your startup, app, concept, or community idea and become part
            of the PANA 2.0 ecosystem.
          </p>

          <a
            href="/submit-project"
            className="rounded-2xl bg-green-500 px-6 py-3 font-bold text-black transition hover:bg-green-400"
          >
            Submit a Project
          </a>
        </div>
      </div>
    </main>
  );
}