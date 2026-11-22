"use client";
import { useActionState } from "react";
import { MESSAGE_LIMITS } from "@/lib/requests";
import type { InterestState } from "@/app/ideas/investor-actions";

export default function InterestForm({ action }: { action: (s: InterestState, fd: FormData) => Promise<InterestState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok) return <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">Sent. The owner will be notified. If they accept, PANA will introduce you both by email.</p>;
  return (
    <form action={formAction} key={state.n ?? 0} className="space-y-3">
      <label className="block text-sm text-gray-300">Why does this idea interest you? <span className="text-gray-500">({MESSAGE_LIMITS[0]}–{MESSAGE_LIMITS[1]} characters, no contact details)</span>
        <textarea name="message" required minLength={MESSAGE_LIMITS[0]} maxLength={MESSAGE_LIMITS[1]} rows={4} defaultValue={state.message ?? ""}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none"
          placeholder="e.g. We support early education projects in St. Lucie County and would like to learn more." />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-black hover:bg-green-400 disabled:opacity-60">{pending ? "Sending…" : "I'm interested"}</button>
    </form>
  );
}
