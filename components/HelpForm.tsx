"use client";

import { useActionState } from "react";
import { MESSAGE_LIMITS } from "@/lib/requests";
import type { HelpState } from "@/app/ideas/needs-actions";

export default function HelpForm({ action, partners, needTitle }: {
  action: (s: HelpState, fd: FormData) => Promise<HelpState>; partners: { id: string; name: string }[]; needTitle: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  if (state.ok) {
    return <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">Offer sent. The owner will be notified. If they accept, PANA will introduce you both by email.</p>;
  }
  return (
    <form action={formAction} className="space-y-3">
      <label className="block text-sm text-gray-300">How can you help with &ldquo;{needTitle}&rdquo;? <span className="text-gray-500">({MESSAGE_LIMITS[0]}–{MESSAGE_LIMITS[1]} characters, no contact details)</span>
        <textarea name="message" required minLength={MESSAGE_LIMITS[0]} maxLength={MESSAGE_LIMITS[1]} rows={3}
          className="mt-1 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none"
          placeholder="e.g. I've mentored two app launches and can meet every other week." />
      </label>
      {partners.length > 0 && (
        <label className="block text-sm text-gray-300">Offer as
          <select name="partner_id" defaultValue="" className="mt-1 w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white">
            <option value="">Myself</option>
            {partners.map((p) => <option key={p.id} value={p.id}>On behalf of {p.name}</option>)}
          </select>
        </label>
      )}
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      <button disabled={pending} className="rounded-xl bg-green-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-green-400 disabled:opacity-60">{pending ? "Sending…" : "Offer help"}</button>
    </form>
  );
}
