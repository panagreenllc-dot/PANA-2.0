"use client";

import { useActionState } from "react";
import { MESSAGE_LIMITS } from "@/lib/collab";
import type { CollabState } from "@/app/ideas/actions";

export default function CollabForm({ action }: { action: (s: CollabState, fd: FormData) => Promise<CollabState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok) {
    return <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">Request sent. The owner will be notified. If they accept, PANA will introduce you both by email.</p>;
  }
  return (
    <form action={formAction} className="space-y-3">
      <label htmlFor="message" className="block text-sm text-gray-300">What can you offer? <span className="text-gray-500">({MESSAGE_LIMITS[0]}–{MESSAGE_LIMITS[1]} characters, no contact details)</span></label>
      <textarea id="message" name="message" required minLength={MESSAGE_LIMITS[0]} maxLength={MESSAGE_LIMITS[1]} rows={4}
        placeholder="e.g. I'm a React developer with 2 years' experience and could help build the MVP."
        className="w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none" />
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-black hover:bg-green-400 disabled:opacity-60">
        {pending ? "Sending…" : "Interested in collaborating"}
      </button>
    </form>
  );
}
