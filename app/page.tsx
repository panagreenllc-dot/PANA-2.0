export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-green-400">
          Welcome to PANA 2.0
        </p>

        <h1 className="mb-6 max-w-4xl text-5xl font-bold leading-tight sm:text-6xl">
          A community-driven platform for builders, innovators, and startups
        </h1>

        <p className="mb-8 max-w-2xl text-lg text-gray-300">
          PANA 2.0 helps entrepreneurs, creators, and tech communities connect,
          showcase projects, discover opportunities, and bring bold ideas to life.
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <button className="rounded-xl bg-green-500 px-6 py-3 font-semibold text-black hover:bg-green-400">
            Join the Community
          </button>
          <button className="rounded-xl border border-white px-6 py-3 font-semibold hover:bg-white hover:text-black">
            Explore Projects
          </button>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid gap-8 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">Tech Con</h2>
            <p className="text-gray-300">
              Discover upcoming tech events, connect with founders, and register
              for opportunities to present your ideas.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">Project Showcase</h2>
            <p className="text-gray-300">
              Highlight startups, apps, community ideas, and creative projects
              built by people shaping the future.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">Community</h2>
            <p className="text-gray-300">
              Build with other innovators, share feedback, and grow inside a
              network designed to support action and collaboration.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20 text-center">
        <h2 className="mb-4 text-4xl font-bold">Built for people with ideas</h2>
        <p className="mx-auto max-w-3xl text-lg text-gray-300">
          Whether you are launching a startup, building a new app, presenting at
          Tech Con, or looking for a community that understands your vision,
          PANA 2.0 is being built to give you a place to start and grow.
        </p>
      </section>

      <footer className="border-t border-white/10 px-6 py-8 text-center text-sm text-gray-400">
        © 2026 PANA 2.0. Built for innovators, founders, and builders.
      </footer>
    </main>
  );
}
