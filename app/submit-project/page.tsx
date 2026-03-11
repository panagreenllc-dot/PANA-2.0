export default function SubmitProjectPage() {
  return (
    <main className="min-h-screen bg-black px-6 py-24 text-white">
      <div className="mx-auto max-w-3xl">
        <div className="mb-14 text-center">
          <p className="mb-4 text-sm uppercase tracking-[0.35em] text-green-400">
            Join the Ecosystem
          </p>

          <h1 className="mb-6 text-5xl font-bold sm:text-6xl">
            Submit Your Project
          </h1>

          <p className="text-lg text-gray-300">
            Share what you're building with the PANA 2.0 community. Startups,
            apps, research, and ideas are all welcome.
          </p>
        </div>

        <form className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8">
          
          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Your Name
            </label>
            <input
              type="text"
              placeholder="John Doe"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-green-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Email
            </label>
            <input
              type="email"
              placeholder="founder@email.com"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-green-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Project Name
            </label>
            <input
              type="text"
              placeholder="Startup or App Name"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-green-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Project Category
            </label>

            <select
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-green-400 focus:outline-none"
            >
              <option>AI</option>
              <option>Startup</option>
              <option>Cybersecurity</option>
              <option>Robotics</option>
              <option>Blockchain</option>
              <option>Community</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Project Description
            </label>

            <textarea
              rows={5}
              placeholder="Tell us what you're building..."
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-green-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Website or GitHub (optional)
            </label>

            <input
              type="text"
              placeholder="https://github.com/your-project"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-green-400 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-2xl bg-green-500 px-6 py-4 text-lg font-bold text-black transition hover:bg-green-400"
          >
            Submit Project
          </button>

        </form>
      </div>
    </main>
  );
}