import Link from "next/link";
import { KINDS, STAGES } from "@/lib/ideas";
import type { IdeaView } from "@/lib/visibility";

const label = (list: readonly { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;

/** Idea card. Takes the gatekeeper's IdeaView (never a raw row). */
export default function ProjectCard({ project, by, membersOnly }: { project: IdeaView; by?: string | null; membersOnly?: boolean }) {
  return (
    <article className="relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-green-400/40">
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full bg-green-500/15 px-3 py-1 font-semibold uppercase tracking-wide text-green-300">{project.category}</span>
        <span className="text-gray-400">{label(KINDS, project.kind)} · {label(STAGES, project.stage)}</span>
        {membersOnly && <span className="rounded-full border border-white/15 px-2 py-0.5 text-gray-400">Members</span>}
      </div>
      <h3 className="mb-1 text-xl font-semibold">
        <Link href={`/ideas/${project.id}`} className="after:absolute after:inset-0 hover:text-green-300">{project.project_name}</Link>
      </h3>
      {by && <p className="mb-4 text-sm text-gray-400">by {by}</p>}
      <p className="mb-4 line-clamp-4 flex-1 text-gray-300">{project.description}</p>
      {project.help_needed && project.help_needed.length > 0 && (
        <p className="text-xs text-green-400">Looking for: {project.help_needed.join(", ")}</p>
      )}
    </article>
  );
}
