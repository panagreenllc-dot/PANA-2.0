"use client";
import { useActionState } from "react";
import { MESSAGE_LIMITS } from "@/lib/requests";
import type { MentorshipState } from "@/app/mentors/actions";

const inp = "mt-1 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none";

export default function MentorshipForm({ action, ideas }: { action: (s: MentorshipState, fd: FormData) => Promise<MentorshipState>; ideas: { id: string; name: string }[] }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok) return <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">Request sent. The mentor will be notified. If they accept, PANA will introduce you both by email.</p>;
  return (
    <form action={formAction} key={state.n ?? 0} className="space-y-3">
      <label className="block text-sm text-gray-300">What would you like help with? <span className="text-gray-500">({MESSAGE_LIMITS[0]}–{MESSAGE_LIMITS[1]} characters, no contact details)</span>
        <textarea name="message" required minLength={MESSAGE_LIMITS[0]} maxLength={MESSAGE_LIMITS[1]} rows={4} defaultValue={state.message ?? ""} className={inp}
          placeholder="e.g. I'm building a tutoring app and would love advice on finding my first users." />
      </label>
      {ideas.length > 0 && (
        <label className="block text-sm text-gray-300">About one of your ideas <span className="text-gray-500">(optional)</span>
          <select name="project_id" defaultValue="" className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
            <option value="">No specific idea</option>
            {ideas.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
      )}
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-black hover:bg-green-400 disabled:opacity-60">{pending ? "Sending…" : "Request mentorship"}</button>
    </form>
  );
}
