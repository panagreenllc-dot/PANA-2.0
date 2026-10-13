import type { Row } from "@/lib/db";

export default function ProjectCard({ project }: { project: Row }) {
  return (
    <article className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-green-400/40">
      <div className="mb-4 flex items-center justify-between text-xs">
        <span className="rounded-full bg-green-500/15 px-3 py-1 font-semibold uppercase tracking-wide text-green-300">
          {project.category}
        </span>
        <span className="text-gray-500">
          {new Date(project.created_at).toLocaleDateString()}
        </span>
      </div>
      <h3 className="mb-1 text-xl font-semibold">{project.project_name}</h3>
      <p className="mb-4 text-sm text-gray-400">by {project.name}</p>
      <p className="mb-6 line-clamp-4 flex-1 text-gray-300">{project.description}</p>
      {project.website && (
        <a
          href={project.website}
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="self-start text-sm font-semibold text-green-400 hover:text-green-300"
        >
          Visit project →
        </a>
      )}
    </article>
  );
}
