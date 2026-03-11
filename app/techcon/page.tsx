export default function TechConPage() {
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="mb-16 text-center">
          <p className="mb-4 text-sm uppercase tracking-[0.35em] text-green-400">
            PANA Tech Con
          </p>

          <h1 className="mb-6 text-5xl font-bold leading-tight sm:text-6xl">
            Where builders, startups, and investors connect
          </h1>

          <p className="mx-auto max-w-3xl text-lg text-gray-300">
            PANA Tech Con is designed to inspire innovation, showcase bold ideas,
            and connect the next generation of founders, creators, developers,
            and tech leaders.
          </p>
        </div>

        <div className="mb-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">Event Location</h2>
            <p className="text-gray-300">
              Miami, Florida
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">Who It’s For</h2>
            <p className="text-gray-300">
              Founders, developers, students, investors, creators, and tech
              enthusiasts ready to connect and build.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-3 text-2xl font-bold">Opportunities</h2>
            <p className="text-gray-300">
              Attend sessions, present your startup, network with builders, and
              discover the next big idea.
            </p>
          </div>
        </div>

        <div className="mb-16 rounded-3xl border border-white/10 bg-white/5 p-8">
          <h2 className="mb-6 text-3xl font-bold">What to expect</h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
              <h3 className="mb-2 text-xl font-semibold">Startup Showcase</h3>
              <p className="text-gray-300">
                Builders and founders can present their startups, apps, and
                prototypes to the community.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
              <h3 className="mb-2 text-xl font-semibold">Networking</h3>
              <p className="text-gray-300">
                Meet entrepreneurs, developers, creators, and future partners in
                one place.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
              <h3 className="mb-2 text-xl font-semibold">Pitch Opportunities</h3>
              <p className="text-gray-300">
                Selected projects may get a chance to pitch in front of the
                audience and future supporters.
              </p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/40 p-6">
              <h3 className="mb-2 text-xl font-semibold">Community Energy</h3>
              <p className="text-gray-300">
                PANA Tech Con is built to make people feel inspired, excited,
                and ready to create something real.
              </p>
            </div>
          </div>
        </div>

        <div className="text-center">
          <h2 className="mb-4 text-3xl font-bold">Be part of the experience</h2>
          <p className="mx-auto mb-8 max-w-2xl text-gray-300">
            Whether you want to attend, present your project, or partner with
            the community, PANA Tech Con is being built for people who want to
            move ideas forward.
          </p>

          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <a
              href="/submit-project"
              className="rounded-2xl bg-green-500 px-6 py-3 font-bold text-black transition hover:bg-green-400"
            >
              Apply to Present
            </a>

            <a
              href="/"
              className="rounded-2xl border border-white px-6 py-3 font-semibold text-white transition hover:bg-white hover:text-black"
            >
              Back to Home
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}