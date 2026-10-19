import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { parseProjectId } from "@/lib/ids";
import { requireMember } from "@/lib/members";
import { getIdea } from "@/lib/ideas-repo";
import IdeaForm from "@/components/IdeaForm";
import { updateIdeaAction } from "../../actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Edit idea", robots: { index: false } };

export default async function EditIdeaPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseProjectId((await params).id);
  if (!id) notFound();
  const { userId } = await requireMember(`/ideas/${id}/edit`);
  const idea = await getIdea(id);
  if (!idea || idea.user_id !== userId) notFound(); // owners only

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <Link href={`/ideas/${id}`} className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← Back to idea</Link>
      <h1 className="mb-3 text-4xl font-bold tracking-tight">Edit your idea</h1>
      <IdeaForm
        action={updateIdeaAction.bind(null, id)}
        submitLabel="Save changes"
        note={idea.status === "approved"
          ? "Your idea is live. Changing the name, short description, details or website sends it back to review (hidden until approved). Changing privacy, type, stage or help needed does not."
          : undefined}
        initial={{
          project_name: idea.project_name, category: idea.category ?? undefined, kind: idea.kind, stage: idea.stage,
          description: idea.description ?? "", details: idea.details ?? "", website: idea.website ?? "",
          help_needed: idea.help_needed ?? [], audience: idea.audience as "public" | "members",
          field_visibility: { details: "members", website: "public", help_needed: "public", ...(idea.field_visibility ?? {}) },
        }}
      />
    </main>
  );
}
