import Link from "next/link";
import { notFound } from "next/navigation";
import sql from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { parseProjectId } from "@/lib/ids";
import IdeaForm from "@/components/IdeaForm";
import { updateProject } from "../../actions";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = parseProjectId(decodeURIComponent((await params).id));
  if (!id) notFound();
  const [project] = await sql`SELECT p.*, COALESCE(p.email, m.email) AS email FROM projects p LEFT JOIN members m ON m.user_id = p.user_id WHERE p.id::text = ${id}`;
  if (!project) notFound();

  return (
    <section className="max-w-2xl">
      <Link href="/admin/projects" className="mb-4 inline-block text-sm text-gray-400 hover:text-white">← Back</Link>
      <h2 className="mb-1 text-xl font-semibold">Edit project #{project.id}</h2>
      <p className="mb-6 text-sm text-gray-400">Submitted by {project.name} ({project.email}) · status: {project.status}</p>
      <IdeaForm
        action={updateProject.bind(null, id)}
        submitLabel="Save changes"
        note="Admin edits don't send the idea back to review."
        initial={{
          project_name: project.project_name, category: project.category, kind: project.kind, stage: project.stage,
          description: project.description ?? "", details: project.details ?? "", website: project.website ?? "",
          help_needed: project.help_needed ?? [], audience: project.audience,
          field_visibility: { details: "members", website: "public", help_needed: "public", ...(project.field_visibility ?? {}) },
        }}
      />
    </section>
  );
}
