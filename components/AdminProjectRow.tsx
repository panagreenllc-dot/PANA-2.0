import { formatDateTime } from "@/lib/datetime";
import type { Row } from "@/lib/db";

export default function AdminProjectRow({ project, children }: { project: Row; children: React.ReactNode }) {
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-gray-500">
            <span className="rounded-full bg-green-500/15 px-2 py-0.5 font-semibold uppercase text-green-300">{project.category}</span>
            <span>#{project.id}</span>
            <span>· submitted {formatDateTime(project.created_at)}</span>
          </div>
          <h3 className="text-lg font-semibold">{project.project_name}</h3>
          <p className="mb-3 text-sm text-gray-400">
            {project.name} {project.email && <>· <a href={`mailto:${project.email}`} className="underline">{project.email}</a></>}
          </p>
          <p className="mb-2 text-xs text-gray-500">
            {project.kind} · {project.stage} · card: {project.audience === "members" ? "members only" : "public"}
            {project.owner_edited_at && <> · <span className="text-yellow-300">edited by owner {formatDateTime(project.owner_edited_at)}</span></>}
            {project.hidden_by_reports && <> · <span className="text-red-300">hidden by reports</span></>}
          </p>
          <p className="whitespace-pre-wrap text-sm text-gray-300">{project.description}</p>
          {project.details && (
            <p className="mt-2 whitespace-pre-wrap text-sm text-gray-400">
              <span className="text-xs uppercase text-gray-500">Details ({project.field_visibility?.details ?? "members"}): </span>{project.details}
            </p>
          )}
          {project.help_needed?.length > 0 && (
            <p className="mt-1 text-xs text-gray-400">Help needed ({project.field_visibility?.help_needed ?? "public"}): {project.help_needed.join(", ")}</p>
          )}
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
