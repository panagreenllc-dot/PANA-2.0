import { formatDate } from "@/lib/datetime";
import { clerkClient } from "@clerk/nextjs/server";
import Link from "next/link";
import sql from "@/lib/db";
import { isAdminUser, requireAdmin } from "@/lib/auth";
import ConfirmButton from "@/components/ConfirmButton";
import { deleteMember, setAdmin, setBanned } from "../actions";

const PAGE_SIZE = 25;

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const me = await requireAdmin();
  const { q = "", page = "1" } = await searchParams;
  const pageNum = Math.max(1, Number(page) || 1);

  const client = await clerkClient();
  const { data: users, totalCount } = await client.users.getUserList({
    query: q || undefined,
    limit: PAGE_SIZE,
    offset: (pageNum - 1) * PAGE_SIZE,
    orderBy: "-created_at",
  });

  const ids = users.map((u) => u.id);
  const counts = ids.length
    ? await sql`SELECT user_id, count(*)::int AS n FROM projects WHERE user_id = ANY(${ids}) GROUP BY user_id`
    : [];
  const countOf = new Map(counts.map((r) => [r.user_id as string, r.n as number]));
  const pages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const btn = "rounded-lg border px-3 py-1.5 text-xs font-semibold";

  return (
    <section>
      <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <h2 className="text-xl font-semibold">Members ({totalCount})</h2>
        <form className="flex gap-2">
          <input name="q" defaultValue={q} placeholder="Search name or email" className="rounded-lg border border-white/10 bg-black px-3 py-2 text-sm" />
          <button className="rounded-lg border border-white/20 px-3 py-2 text-sm">Search</button>
        </form>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/5 text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">Member</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Projects</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10">
            {users.map((u) => {
              const admin = isAdminUser(u);
              const self = u.id === me.id;
              const email = u.primaryEmailAddress?.emailAddress ?? u.emailAddresses[0]?.emailAddress ?? "";
              return (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <p className="font-medium">{[u.firstName, u.lastName].filter(Boolean).join(" ") || u.username || "—"}</p>
                    <p className="text-gray-400">{email}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-400">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">{countOf.get(u.id) ?? 0}</td>
                  <td className="px-4 py-3 space-x-1">
                    {admin && <span className="rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-300">admin</span>}
                    {u.banned && <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">banned</span>}
                    {self && <span className="text-xs text-gray-500">(you)</span>}
                  </td>
                  <td className="px-4 py-3">
                    {!self && (
                      <div className="flex flex-wrap justify-end gap-2">
                        <form action={setAdmin}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="makeAdmin" value={String(!admin)} />
                          <ConfirmButton message={admin ? `Remove admin from ${email}?` : `Make ${email} an admin?`} className={`${btn} border-white/20 hover:bg-white/10`}>
                            {admin ? "Remove admin" : "Make admin"}
                          </ConfirmButton>
                        </form>
                        <form action={setBanned}>
                          <input type="hidden" name="userId" value={u.id} />
                          <input type="hidden" name="ban" value={String(!u.banned)} />
                          <ConfirmButton message={u.banned ? `Unban ${email}?` : `Ban ${email}? They will be signed out and blocked.`} className={`${btn} border-amber-500/40 text-amber-300 hover:bg-amber-500/10`}>
                            {u.banned ? "Unban" : "Ban"}
                          </ConfirmButton>
                        </form>
                        <form action={deleteMember} className="flex items-center gap-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <label className="flex items-center gap-1 text-xs text-gray-400">
                            <input type="checkbox" name="deleteProjects" /> + projects
                          </label>
                          <ConfirmButton message={`Permanently delete ${email}? This cannot be undone.`} className={`${btn} border-red-500/40 text-red-300 hover:bg-red-500/10`}>
                            Delete
                          </ConfirmButton>
                        </form>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-3 text-sm">
          {pageNum > 1 && <Link href={`?q=${encodeURIComponent(q)}&page=${pageNum - 1}`} className="underline">Previous</Link>}
          <span className="text-gray-400">Page {pageNum} of {pages}</span>
          {pageNum < pages && <Link href={`?q=${encodeURIComponent(q)}&page=${pageNum + 1}`} className="underline">Next</Link>}
        </div>
      )}
    </section>
  );
}
