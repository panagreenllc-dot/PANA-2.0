import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import sql from "../../lib/db";

async function submitProject(formData: FormData) {
  "use server";

  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const user = await currentUser();

  const name =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.username ||
    "Unknown Founder";

  const email =
    user?.primaryEmailAddress?.emailAddress || "";

  const project_name = formData.get("project_name") as string;
  const category = formData.get("category") as string;
  const description = formData.get("description") as string;
  const website = formData.get("website") as string;

  await sql`
    INSERT INTO projects
    (name, email, project_name, category, description, website)
    VALUES
    (${name}, ${email}, ${project_name}, ${category}, ${description}, ${website})
  `;
}

export default async function SubmitProjectPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

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

        <form
          action={submitProject}
          className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-8"
        >
          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Project Name
            </label>
            <input
              name="project_name"
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
              name="category"
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-green-400 focus:outline-none"
            >
              <option value="AI">AI</option>
              <option value="Startup">Startup</option>
              <option value="Cybersecurity">Cybersecurity</option>
              <option value="Robotics">Robotics</option>
              <option value="Blockchain">Blockchain</option>
              <option value="Community">Community</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Project Description
            </label>
            <textarea
              name="description"
              rows={5}
              placeholder="Tell us what you're building..."
              className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white focus:border-green-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-gray-300">
              Website or GitHub
            </label>
            <input
              name="website"
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