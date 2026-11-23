import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import CohortForm from "@/components/CohortForm";
import { formatDateTime, formatDay } from "@/lib/datetime";
import { cohortPhase } from "@/lib/incubator";
import { adminCohorts } from "@/lib/incubator-repo";
import { createCohortAction } from "./actions";

export default async function AdminIncubatorPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  const cohorts = await adminCohorts();
  return (
    <section className="space-y-10">
      <AdminNotice error={error} />
      <div>
        <h2 className="mb-4 text-xl font-semibold">Incubator cohorts ({cohorts.length})</h2>
        {cohorts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 p-8 text-gray-400">No cohorts yet. Create the first one below.</p>
        ) : (
          <ul className="space-y-3">
            {cohorts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/10 p-5">
                <div>
                  <Link href={`/admin/incubator/${c.id}`} className="text-lg font-semibold hover:text-green-300">{c.name}</Link>
                  <p className="text-xs text-gray-500">
                    {c.status} ({cohortPhase(c as never)}) · closes {formatDateTime(c.apply_closes_at) || "—"}
                    {c.starts_on ? ` · starts ${formatDay(c.starts_on)}` : ""}{c.capacity ? ` · soft limit ${c.capacity}` : " · no fixed spots"}
                  </p>
                </div>
                <div className="flex gap-2 text-xs">
                  <span className="rounded-full bg-yellow-500/15 px-2 py-1 text-yellow-200">{c.to_review} to review</span>
                  <span className="rounded-full bg-white/10 px-2 py-1">{c.waitlisted} waitlisted</span>
                  <span className="rounded-full bg-green-500/15 px-2 py-1 text-green-300">{c.accepted} accepted</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <h2 className="mb-4 text-xl font-semibold">New cohort</h2>
        <CohortForm action={createCohortAction} submitLabel="Create cohort" />
      </div>
    </section>
  );
}
