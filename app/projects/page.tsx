export default function ProjectsPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white">
      <div className="mx-auto max-w-6xl">
        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-green-400">
          Projects
        </p>

        <h1 className="mb-6 text-5xl font-bold">Discover what people are building</h1>

        <p className="mb-10 max-w-3xl text-lg text-gray-300">
          Explore startups, apps, experiments, and community ideas from builders
          inside the PANA 2.0 ecosystem.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-2 text-xl font-bold">AI Tools</h2>
            <p className="text-gray-300">Projects using AI to solve real problems.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-2 text-xl font-bold">Startups</h2>
            <p className="text-gray-300">Early-stage ventures looking to grow and connect.</p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-2 text-xl font-bold">Community Ideas</h2>
            <p className="text-gray-300">Concepts, prototypes, and ideas from the community.</p>
          </div>
        </div>
      </div>
    </main>
  );
}