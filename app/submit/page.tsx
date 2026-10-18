import { requireMember } from "@/lib/members";
import type { Metadata } from "next";
import ProjectForm from "@/components/ProjectForm";
import { submitProject } from "./actions";

export const metadata: Metadata = { title: "Submit an Idea" };

export default async function SubmitProjectPage() {
  await requireMember("/submit");

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Submit</p>
      <h1 className="mb-3 text-4xl font-bold tracking-tight">Share your idea</h1>
      <p className="mb-10 text-gray-400">
        Submissions are reviewed by the PANA team before they appear publicly — usually within a few days.
        Early ideas and working projects are both welcome. Want to present at Treasure Coast Tech Con? Mention it in your description.
      </p>
      <ProjectForm action={submitProject} submitLabel="Submit for review" />
    </main>
  );
}
