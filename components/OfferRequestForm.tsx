"use client";

import Link from "next/link";
import { useActionState } from "react";
import { MESSAGE_LIMITS } from "@/lib/requests";
import type { OfferRequestState } from "@/app/offers/actions";

export default function OfferRequestForm({ action, ideas }: {
  action: (s: OfferRequestState, fd: FormData) => Promise<OfferRequestState>; ideas: { id: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok) {
    return (
      <div role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
        Request sent. If it&apos;s accepted, PANA will introduce you by email.{" "}
        {state.id && <Link href={`/me/requests/offers/${state.id}`} className="underline">Track it</Link>}
      </div>
    );
  }
  return (
    <form action={formAction} className="space-y-4">
      <label className="block text-sm text-gray-300">What would you like to use, and when? <span className="text-gray-500">({MESSAGE_LIMITS[0]}–{MESSAGE_LIMITS[1]} characters, no contact details)</span>
        <textarea name="message" required minLength={MESSAGE_LIMITS[0]} maxLength={MESSAGE_LIMITS[1]} rows={4}
          placeholder="e.g. I'd like two evenings of lab time in March to test my app with 5 users."
          className="mt-1 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none" />
      </label>
      {ideas.length > 0 && (
        <label className="block text-sm text-gray-300">Related idea <span className="text-gray-500">(optional, shown to the partner)</span>
          <select name="project_id" defaultValue="" className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
            <option value="">None</option>
            {ideas.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
          </select>
        </label>
      )}
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-green-500 px-5 py-3 font-semibold text-black hover:bg-green-400 disabled:opacity-60">{pending ? "Sending…" : "Send request"}</button>
    </form>
  );
}
