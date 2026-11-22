import Link from "next/link";
import type { Metadata } from "next";
import { requireMember } from "@/lib/members";
import { getProfileRow } from "@/lib/profiles-repo";
import ProfileForm from "@/components/ProfileForm";
import { saveProfileAction, togglePublishAction } from "./actions";
import { pauseMentorAction, removeRoleAction, saveInvestorAction, saveMentorAction } from "./role-actions";
import { myInvestor, myMentor } from "@/lib/mentors-repo";
import { ROLE_STATUS_LABEL } from "@/lib/mentors";
import { MentorForm, InvestorForm } from "@/components/RoleForms";
import ConfirmButton from "@/components/ConfirmButton";

const ROLE_NOTICES: Record<string, string> = {
  paused: "Paused. You're hidden from the mentor directory and won't get new requests.",
  resumed: "Welcome back. You're in the mentor directory again.",
  "removed-mentor": "Your mentor application or badge was removed.",
  "removed-investor": "Your investor application or badge was removed.",
};
const pill = (s: string) => `rounded-full px-2 py-0.5 text-xs ${s === "approved" ? "bg-green-500/15 text-green-300" : s === "pending" || s === "paused" ? "bg-yellow-500/15 text-yellow-200" : "bg-white/10 text-gray-300"}`;

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "My profile", robots: { index: false, follow: false } };

export default async function MyProfilePage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { userId, user } = await requireMember("/me/profile");
  const sp = await searchParams;
  const p = await getProfileRow(userId);
  const [mentor, investor] = await Promise.all([myMentor(userId).catch(() => null), myInvestor(userId).catch(() => null)]);
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

      {sp.role && ROLE_NOTICES[sp.role] && <p className="mt-12 rounded-xl border border-white/15 px-4 py-3 text-sm text-gray-300">{ROLE_NOTICES[sp.role]}</p>}

      <section id="mentor" className="mt-12 scroll-mt-24 rounded-2xl border border-white/10 p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Mentor</h2>
          {mentor && <span className={pill(mentor.status)}>{ROLE_STATUS_LABEL[mentor.status] ?? mentor.status}</span>}
        </div>
        <p className="mb-4 text-sm text-gray-400">
          Volunteer to mentor PANA members. The PANA team reviews every application. Approved mentors get a mentor badge and appear in the
          members-only <Link href="/mentors" className="text-green-400 underline">mentor directory</Link>. You accept or decline each request; your email is
          shared only in the introduction after you accept. Changing your answers sends it back for review.
        </p>
        {mentor?.review_note && (mentor.status === "declined" || mentor.status === "revoked") && <p className="mb-4 text-sm text-yellow-200">Note from the PANA team: {mentor.review_note}</p>}
        {mentor?.status === "revoked" ? (
          <p className="text-sm text-gray-400">PANA removed your mentor badge. Contact PANA if you have questions.</p>
        ) : (
          <>
            <MentorForm action={saveMentorAction} submitLabel={mentor ? "Save mentor details" : "Apply to be a mentor"}
              initial={mentor ? { expertise: mentor.expertise, bio: mentor.bio, availability: mentor.availability, max_open_mentees: mentor.max_open_mentees } : null} />
            {mentor && (
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {mentor.status === "approved" && <form action={pauseMentorAction}><input type="hidden" name="to" value="pause" /><button className="rounded-lg border border-white/20 px-3 py-1.5 hover:bg-white/10">Pause new requests</button></form>}
                {mentor.status === "paused" && <form action={pauseMentorAction}><input type="hidden" name="to" value="resume" /><button className="rounded-lg border border-green-500/40 px-3 py-1.5 text-green-300 hover:bg-green-500/10">Resume</button></form>}
                <form action={removeRoleAction}><input type="hidden" name="role" value="mentor" />
                  <ConfirmButton message="Remove your mentor application or badge? Requests already accepted stay as they are." className="rounded-lg border border-red-500/40 px-3 py-1.5 text-red-300 hover:bg-red-500/10">{mentor.status === "pending" ? "Withdraw application" : "Stop mentoring"}</ConfirmButton></form>
              </div>
            )}
          </>
        )}
      </section>

      <section id="investor" className="mt-8 scroll-mt-24 rounded-2xl border border-white/10 p-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl font-semibold">Investor or supporter</h2>
          {investor && <span className={pill(investor.status)}>{ROLE_STATUS_LABEL[investor.status] ?? investor.status}</span>}
        </div>
        <p className="mb-4 text-sm text-gray-400">
          For people and organizations who&apos;d like to hear from ideas looking for investors, sponsors or grant-makers. The PANA team reviews every
          application. Approved investors get a badge on their profile and can say &ldquo;I&apos;m interested&rdquo; only on ideas whose owners opened them to
          investor interest. There&apos;s no investor directory. PANA doesn&apos;t vet anyone, give investment advice, or take part in any deal.
        </p>
        {investor?.review_note && (investor.status === "declined" || investor.status === "revoked") && <p className="mb-4 text-sm text-yellow-200">Note from the PANA team: {investor.review_note}</p>}
        {investor?.status === "revoked" ? (
          <p className="text-sm text-gray-400">PANA removed your investor badge. Contact PANA if you have questions.</p>
        ) : (
          <>
            <InvestorForm action={saveInvestorAction} submitLabel={investor ? "Save investor details" : "Apply as an investor"}
              initial={investor ? { investor_type: investor.investor_type, focus_categories: investor.focus_categories, stage_focus: investor.stage_focus, organization: investor.organization, bio: investor.bio } : null} />
            {investor && (
              <div className="mt-4 flex flex-wrap gap-3 text-sm">
                {investor.status === "approved" && <Link href="/ideas?open_to_investment=1" className="rounded-lg border border-green-500/40 px-3 py-1.5 text-green-300 hover:bg-green-500/10">Ideas open to investor interest</Link>}
                <form action={removeRoleAction}><input type="hidden" name="role" value="investor" />
                  <ConfirmButton message="Remove your investor application or badge?" className="rounded-lg border border-red-500/40 px-3 py-1.5 text-red-300 hover:bg-red-500/10">{investor.status === "pending" ? "Withdraw application" : "Remove investor badge"}</ConfirmButton></form>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
