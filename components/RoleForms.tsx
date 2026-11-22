"use client";
// Mentor / investor application forms on /me/profile (P3-3).
import { useActionState } from "react";
import { EXPERTISE, INVESTOR_TYPES, MENTOR_LIMITS, type InvestorInput, type MentorInput } from "@/lib/mentors";
import { CATEGORIES, STAGES } from "@/lib/ideas";
import type { RoleFormState } from "@/app/me/profile/role-actions";

const inp = "w-full rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none";
const box = "flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-sm text-gray-300";

const arr = (v: unknown) => (Array.isArray(v) ? v.map(String) : []);
const str = (v: unknown) => (typeof v === "string" ? v : "");

function Result({ s }: { s: RoleFormState }) {
  return <>{s.error && <p role="alert" className="text-sm text-red-400">{s.error}</p>}{s.notice && <p role="status" className="text-sm text-green-300">{s.notice}</p>}</>;
}

export function MentorForm({ action, initial, submitLabel }: { action: (s: RoleFormState, fd: FormData) => Promise<RoleFormState>; initial: MentorInput | null; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const sv = state.values;
  const v: MentorInput | null = sv
    ? { expertise: arr(sv.expertise), bio: str(sv.bio), availability: str(sv.availability), max_open_mentees: Number(str(sv.max_open_mentees)) || 3 }
    : initial;
  return (
    <form action={formAction} key={state.n ?? 0} className="space-y-4">
      <fieldset>
        <legend className="mb-2 text-sm text-gray-300">Areas you can mentor in <span className="text-gray-500">(1–{MENTOR_LIMITS.expertise})</span></legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {EXPERTISE.map((e) => <label key={e.value} className={box}><input type="checkbox" name="expertise" value={e.value} defaultChecked={v?.expertise.includes(e.value)} className="h-4 w-4 accent-green-500" />{e.label}</label>)}
        </div>
      </fieldset>
      <label className="block text-sm text-gray-300">How you can help <span className="text-gray-500">(20–1,000 characters, no contact details)</span>
        <textarea name="bio" required minLength={20} maxLength={1000} rows={4} defaultValue={v?.bio ?? ""} className={`${inp} mt-1`}
          placeholder="e.g. I've built and launched two mobile apps and can help with product planning and first users." />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">Availability <span className="text-gray-500">(optional)</span>
          <input name="availability" maxLength={60} defaultValue={v?.availability ?? ""} placeholder="e.g. 2 hrs/month, evenings" className={`${inp} mt-1`} />
        </label>
        <label className="block text-sm text-gray-300">Mentees at a time
          <select name="max_open_mentees" defaultValue={String(v?.max_open_mentees ?? 3)} className={`${inp} mt-1`}>
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <Result s={state} />
      <button disabled={pending} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400 disabled:opacity-60">{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}

export function InvestorForm({ action, initial, submitLabel }: { action: (s: RoleFormState, fd: FormData) => Promise<RoleFormState>; initial: InvestorInput | null; submitLabel: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  const sv = state.values;
  const v: InvestorInput | null = sv
    ? { investor_type: str(sv.investor_type), organization: str(sv.organization), bio: str(sv.bio), focus_categories: arr(sv.focus_categories), stage_focus: arr(sv.stage_focus) }
    : initial;
  return (
    <form action={formAction} key={state.n ?? 0} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm text-gray-300">You are
          <select name="investor_type" required defaultValue={v?.investor_type ?? ""} className={`${inp} mt-1`}>
            <option value="" disabled>Choose one</option>
            {INVESTOR_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label className="block text-sm text-gray-300">Organization <span className="text-gray-500">(optional)</span>
          <input name="organization" maxLength={120} defaultValue={v?.organization ?? ""} className={`${inp} mt-1`} />
        </label>
      </div>
      <fieldset>
        <legend className="mb-2 text-sm text-gray-300">Categories you focus on <span className="text-gray-500">(optional)</span></legend>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => <label key={c} className={box}><input type="checkbox" name="focus_categories" value={c} defaultChecked={v?.focus_categories.includes(c)} className="h-4 w-4 accent-green-500" />{c}</label>)}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-2 text-sm text-gray-300">Stages <span className="text-gray-500">(optional)</span></legend>
        <div className="flex flex-wrap gap-2">
          {STAGES.map((s) => <label key={s.value} className={box}><input type="checkbox" name="stage_focus" value={s.value} defaultChecked={v?.stage_focus.includes(s.value)} className="h-4 w-4 accent-green-500" />{s.label}</label>)}
        </div>
      </fieldset>
      <label className="block text-sm text-gray-300">What you look for <span className="text-gray-500">(20–1,000 characters; no money amounts or contact details)</span>
        <textarea name="bio" required minLength={20} maxLength={1000} rows={4} defaultValue={v?.bio ?? ""} className={`${inp} mt-1`}
          placeholder="e.g. Early community and education projects on the Treasure Coast." />
      </label>
      <Result s={state} />
      <button disabled={pending} className="rounded-lg bg-green-500 px-4 py-2 text-sm font-semibold text-black hover:bg-green-400 disabled:opacity-60">{pending ? "Saving…" : submitLabel}</button>
    </form>
  );
}
