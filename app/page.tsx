export default function Home() {
  return (
    <main className="min-h-screen bg-black text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="text-xl font-bold tracking-wide">PANA 2.0</div>

          <nav className="hidden gap-6 text-sm text-gray-300 md:flex">
            <a href="#about" className="hover:text-white">
              About
            </a>
            <a href="#techcon" className="hover:text-white">
              Tech Con
            </a>
            <a href="#projects" className="hover:text-white">
              Projects
            </a>
            <a href="#community" className="hover:text-white">
              Community
            </a>
          </nav>

          <button className="rounded-xl bg-green-500 px-4 py-2 font-semibold text-black hover:bg-green-400">
            Join Now
          </button>
        </div>
      </header>

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

      <<section id="techcon" className="mx-auto max-w-6xl px-6 py-24">
  <h2 className="text-4xl font-bold text-center mb-12">
    PANA Tech Con
  </h2>

  <div className="grid gap-8 md:grid-cols-3">

    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-xl font-bold mb-2">Event Date</h3>
      <p className="text-gray-300">
        Coming Soon — Miami, Florida
      </p>
    </div>

    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-xl font-bold mb-2">Startup Presentations</h3>
      <p className="text-gray-300">
        Founders and developers can present their projects to investors
        and the tech community.
      </p>
    </div>

    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h3 className="text-xl font-bold mb-2">Networking</h3>
      <p className="text-gray-300">
        Connect with developers, entrepreneurs, investors, and builders.
      </p>
    </div>

  </div>

  <div className="text-center mt-12">
    <button className="bg-green-500 text-black px-8 py-3 rounded-xl font-semibold hover:bg-green-400">
      Apply to Present
    </button>
  </div>
</section>

      <section id="about" className="mx-auto max-w-5xl px-6 py-20 text-center">
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
