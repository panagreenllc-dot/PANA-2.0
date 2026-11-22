"use client";

import { useActionState, useState } from "react";
import { CAN_OFFER, HONEYPOT, PARTNER_KINDS, type InquiryFormState } from "@/lib/partners";
import { inquiryAction } from "./actions";

const input = "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-white placeholder:text-gray-600 focus:border-green-500 focus:outline-none";
const label = "mb-1 block text-sm text-gray-300";

export default function InquiryForm() {
  const [state, formAction, pending] = useActionState<InquiryFormState, FormData>(inquiryAction, {});
  const [started] = useState(() => Date.now());
  if (state.ok) {
    return (
      <div className="rounded-2xl border border-green-500/40 bg-green-500/10 p-8" role="status">
        <h3 className="mb-2 text-xl font-semibold">Thank you!</h3>
        <p className="text-gray-300">We received your message. John from PANA will be in touch by email.</p>
      </div>
    );
  }
  const v = (state.values ?? {}) as Record<string, string | string[]>;
  const fe = state.fieldErrors ?? {};
  const err = (k: string) => fe[k] && <p className="mt-1 text-xs text-red-400">{fe[k]}</p>;
  const offers = new Set((v.can_offer as string[]) ?? []);
  return (
    <form action={formAction} className="space-y-5 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
      <input type="hidden" name="form_started" value={started} suppressHydrationWarning />
      {/* Honeypot: hidden from people and screen readers; bots that fill it are ignored. */}
      <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
        <label htmlFor={HONEYPOT}>Fax number</label>
        <input id={HONEYPOT} name={HONEYPOT} type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {state.error && <p className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">{state.error}</p>}
      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className={label} htmlFor="org_name">Organization or sponsor name *</label>
          <input id="org_name" name="org_name" required minLength={2} maxLength={120} defaultValue={String(v.org_name ?? "")} className={input} placeholder="e.g. Fort Pierce Library" />
          {err("org_name")}
        </div>
        <div>
          <label className={label} htmlFor="kind">Type *</label>
          <select id="kind" name="kind" defaultValue={String(v.kind ?? "business")} className={input}>
            {PARTNER_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          {err("kind")}
        </div>
        <div>
          <label className={label} htmlFor="contact_name">Your name *</label>
          <input id="contact_name" name="contact_name" required minLength={2} maxLength={80} defaultValue={String(v.contact_name ?? "")} className={input} autoComplete="name" />
          {err("contact_name")}
        </div>
        <div>
          <label className={label} htmlFor="contact_email">Your email *</label>
          <input id="contact_email" name="contact_email" type="email" required maxLength={254} defaultValue={String(v.contact_email ?? "")} className={input} autoComplete="email" />
          <p className="mt-1 text-xs text-gray-500">Only PANA admins see this. It&apos;s never shown on the site.</p>
          {err("contact_email")}
        </div>
      </div>
      <fieldset>
        <legend className={label}>What could you offer? (optional)</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CAN_OFFER.map((o) => (
            <label key={o.value} className="flex items-center gap-2 text-sm text-gray-300">
              <input type="checkbox" name="can_offer" value={o.value} defaultChecked={offers.has(o.value)} className="h-4 w-4 accent-green-500" /> {o.label}
            </label>
          ))}
        </div>
        {err("can_offer")}
      </fieldset>
      <div>
        <label className={label} htmlFor="message">Message (optional)</label>
        <textarea id="message" name="message" rows={4} maxLength={2000} defaultValue={String(v.message ?? "")} className={input} placeholder="For example: our lab is free Tue/Thu evenings, or we'd like to sponsor a student project." />
        {err("message")}
      </div>
      <p className="text-xs text-gray-500">PANA doesn&apos;t handle money. Partners provide access or support directly to participants. We&apos;ll only use your details to reply.</p>
      <button disabled={pending} className="rounded-xl bg-green-500 px-6 py-3 font-semibold text-black transition hover:bg-green-400 disabled:opacity-60">
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
