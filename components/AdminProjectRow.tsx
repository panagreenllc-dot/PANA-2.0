import type { Row } from "@/lib/db";

export default function AdminProjectRow({ project, children }: { project: Row; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-semibold uppercase text-green-300">{project.category}</span>
            <span>#{project.id}</span>
            <span>· submitted {new Date(project.created_at).toLocaleString()}</span>
          </div>
          <h3 className="text-lg font-semibold">{project.project_name}</h3>
          <p className="mb-3 text-sm text-gray-400">
            {project.name} {project.email && <>· <a href={`mailto:${project.email}`} className="underline">{project.email}</a></>}
          </p>
          <p className="whitespace-pre-wrap text-sm text-gray-300">{project.description}</p>
          {project.website && (
            <a href={project.website} target="_blank" rel="noopener noreferrer nofollow" className="mt-2 inline-block break-all text-sm text-green-400">
              {project.website}
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">{children}</div>
      </div>
    </li>
  );
}
