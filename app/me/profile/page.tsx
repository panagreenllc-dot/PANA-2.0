import Link from "next/link";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { getProfileRow } from "@/lib/profiles-repo";
import ProfileForm from "@/components/ProfileForm";
import { saveProfileAction, togglePublishAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My profile", robots: { index: false, follow: false } };

export default async function MyProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { userId, user } = await requireMember("/me/profile");
  const sp = await searchParams;
  const p = await getProfileRow(userId);
  const fallbackName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.username || "";

  return (
    <main className="mx-auto max-w-2xl px-6 py-20">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">My profile</p>
      <h1 className="mb-3 text-4xl font-bold tracking-tight">Your member profile</h1>
      <p className="mb-8 text-gray-400">
        Your profile is <strong>private until you publish it</strong>. Once published, it&apos;s visible only to signed-in
        PANA members, never to the public or search engines. Your email is never shown.
      </p>

      {sp.error === "save-first" && <p className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">Save your profile before publishing it.</p>}
      {sp.published && <p className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">Your profile is published to members.</p>}
      {sp.unpublished && <p className="mb-6 rounded-xl border border-white/15 px-4 py-3 text-sm text-gray-300">Your profile is now private.</p>}

      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-white/10 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-400">Status</p>
          <p className="font-semibold">
            {!p ? "Not created yet" : p.moderation === "hidden" ? "Hidden by moderators" : p.is_published ? "Published to members" : "Private (only you)"}
          </p>
          {p?.moderation === "hidden" && <p className="mt-1 text-xs text-gray-500">An admin will review it. Contact us if you think this is a mistake.</p>}
        </div>
        <div className="flex gap-2">
          {p && (
            <Link href={`/members/${userId}`} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white hover:text-black">Preview</Link>
          )}
          {p && (
            <form action={togglePublishAction}>
              <input type="hidden" name="publish" value={String(!p.is_published)} />
              <button className={p.is_published ? "rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold hover:bg-white hover:text-black" : "rounded-xl bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400"}>
                {p.is_published ? "Unpublish" : "Publish"}
              </button>
            </form>
          )}
        </div>
      </div>

      <ProfileForm action={saveProfileAction} initial={p ?? { display_name: fallbackName }} />
    </main>
  );
}
