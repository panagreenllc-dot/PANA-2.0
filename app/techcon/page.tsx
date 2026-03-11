export default function TechConPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-green-400">
          PANA Tech Con
        </p>

        <h1 className="mb-6 text-5xl font-bold">Where builders meet opportunity</h1>

        <p className="mb-10 max-w-3xl text-lg text-gray-300">
          PANA Tech Con is designed to bring together founders, developers,
          investors, creators, and tech enthusiasts for networking, startup
          discovery, and real collaboration.
        </p>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">Attend</h2>
            <p className="text-gray-300">
              Join a growing tech community and discover startups, tools, and ideas.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">Present</h2>
            <p className="text-gray-300">
              Show your startup, app, or concept to an audience ready to connect.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">Connect</h2>
            <p className="text-gray-300">
              Meet entrepreneurs, investors, and builders shaping the future.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}