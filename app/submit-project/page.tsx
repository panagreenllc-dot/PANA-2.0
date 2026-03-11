export default function SubmitProjectPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white">
      <div className="mx-auto max-w-3xl">
        <p className="mb-4 text-sm uppercase tracking-[0.35em] text-green-400">
          Submit Project
        </p>

        <h1 className="mb-6 text-5xl font-bold">Share what you are building</h1>

        <p className="mb-10 text-lg text-gray-300">
          Submit your startup, app, concept, or community idea to be featured on
          PANA 2.0 and considered for Tech Con presentations.
        </p>

        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <form className="space-y-5">
            <div>
              <label className="mb-2 block text-sm text-gray-300">Project Name</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
                placeholder="Enter your project name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">Founder / Team Name</label>
              <input
                type="text"
                className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
                placeholder="Your name or team name"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm text-gray-300">Short Description</label>
              <textarea
                className="min-h-[140px] w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white outline-none"
                placeholder="Tell people what your project does"
              />
            </div>

            <button className="rounded-xl bg-green-500 px-6 py-3 font-semibold text-black hover:bg-green-400">
              Submit Project
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}