import Link from "next/link";
import { notFound } from "next/navigation";
import sql from "@/lib/db";
import { parseProjectId } from "@/lib/ids";
import ProjectForm from "@/components/ProjectForm";
import { updateProject } from "../../actions";

export default async function EditProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseProjectId(decodeURIComponent((await params).id));
  if (!id) notFound();
  const [project] = await sql`SELECT * FROM projects WHERE id::text = ${id}`;
  if (!project) notFound();

  return (
    <section className="max-w-2xl">
      <Link href="/admin/projects" className="mb-4 inline-block text-sm text-gray-400 hover:text-white">← Back</Link>
      <h2 className="mb-1 text-xl font-semibold">Edit project #{project.id}</h2>
      <p className="mb-6 text-sm text-gray-400">Submitted by {project.name} ({project.email}) · status: {project.status}</p>
      <ProjectForm
        action={updateProject.bind(null, id)}
        submitLabel="Save changes"
        initial={{
          project_name: project.project_name,
          category: project.category,
          description: project.description,
          website: project.website ?? "",
        }}
      />
    </section>
  );
}
