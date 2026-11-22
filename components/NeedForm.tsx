"use client";

import { useActionState } from "react";
import { NEED_KINDS, type NeedInput } from "@/lib/needs";
import type { NeedFormState } from "@/app/ideas/needs-actions";

const inp = "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none";

export default function NeedForm({ action, initial, submitLabel }: {
  action: (s: NeedFormState, fd: FormData) => Promise<NeedFormState>; initial?: NeedInput; submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values ?? initial;
  // After adding, reset the form by remounting it (key changes once ok).
  return (
    <form action={formAction} key={state.ok && !initial ? "done" : "form"} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">What kind of help?
          <select name="kind" required defaultValue={v?.kind ?? ""} className={`${inp} mt-1`}>
            <option value="" disabled>Choose one</option>
            {NEED_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
        </label>
        <label className="block text-sm text-gray-300">How much / how often <span className="text-gray-500">(optional)</span>
          <input name="amount_text" maxLength={60} defaultValue={v?.amount_text ?? ""} placeholder="e.g. 2 hrs/week, one afternoon" className={`${inp} mt-1`} />
        </label>
      </div>
      <label className="block text-sm text-gray-300">Short title
        <input name="title" required minLength={3} maxLength={120} defaultValue={v?.title ?? ""} placeholder="e.g. A mentor who has launched a mobile app" className={`${inp} mt-1`} />
      </label>
      <label className="block text-sm text-gray-300">Details <span className="text-gray-500">(optional, no contact details or money amounts)</span>
        <textarea name="details" maxLength={1000} rows={3} defaultValue={v?.details ?? ""} className={`${inp} mt-1`} />
      </label>
      {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
      {state.notice && <p role="status" className="text-sm text-green-300">{state.notice}</p>}
      <button disabled={pending} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400 disabled:opacity-60">{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
