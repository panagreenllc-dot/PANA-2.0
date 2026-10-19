"use client";

import { useActionState } from "react";
import { LIMITS, LINK_KINDS, LOOKING_FOR, ROLES, type ProfileFormState } from "@/lib/profile-input";

const input = "w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none";

export type ProfileFormInitial = {
  display_name?: string; headline?: string | null; experience?: string | null;
  roles?: string[]; skills?: string[]; interests?: string[]; looking_for?: string[];
  links?: Record<string, string> | null;
};

export default function ProfileForm({ action, initial }: {
  action: (s: ProfileFormState, fd: FormData) => Promise<ProfileFormState>;
  initial: ProfileFormInitial;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const fe = state.fieldErrors ?? {};
  const err = (k: string) => (fe as Record<string, string>)[k] ? <p className="mt-1 text-sm text-red-400">{(fe as Record<string, string>)[k]}</p> : null;

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
      {state.error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      {state.ok && <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">Profile saved.</p>}
      <p className="text-sm text-gray-400">Don&apos;t include email addresses or phone numbers. Members contact each other through PANA.</p>

      <div>
        <label htmlFor="display_name" className="mb-2 block text-sm text-gray-300">Name *</label>
        <input id="display_name" name="display_name" required minLength={LIMITS.displayName[0]} maxLength={LIMITS.displayName[1]} defaultValue={initial.display_name} className={input} />
        {err("display_name")}
      </div>
      <div>
        <label htmlFor="headline" className="mb-2 block text-sm text-gray-300">Headline</label>
        <input id="headline" name="headline" maxLength={LIMITS.headline} defaultValue={initial.headline ?? ""} placeholder="e.g. CS student building AI tools for small businesses" className={input} />
        {err("headline")}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm text-gray-300">Roles</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {ROLES.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="roles" value={r.value} defaultChecked={initial.roles?.includes(r.value)} className="h-4 w-4 accent-green-500" />
              {r.label}
            </label>
          ))}
        </div>
        {err("roles")}
      </fieldset>

      <div>
        <label htmlFor="skills" className="mb-2 block text-sm text-gray-300">Skills <span className="text-gray-500">(comma-separated, up to {LIMITS.tagCount})</span></label>
        <input id="skills" name="skills" defaultValue={initial.skills?.join(", ")} placeholder="React, Python, marketing" className={input} />
        {err("skills")}
      </div>
      <div>
        <label htmlFor="interests" className="mb-2 block text-sm text-gray-300">Interests <span className="text-gray-500">(comma-separated, up to {LIMITS.tagCount})</span></label>
        <input id="interests" name="interests" defaultValue={initial.interests?.join(", ")} placeholder="Climate tech, robotics" className={input} />
        {err("interests")}
      </div>
      <div>
        <label htmlFor="experience" className="mb-2 block text-sm text-gray-300">Experience <span className="text-gray-500">(up to {LIMITS.experience} characters)</span></label>
        <textarea id="experience" name="experience" rows={5} maxLength={LIMITS.experience} defaultValue={initial.experience ?? ""} className={input} />
        {err("experience")}
      </div>

      <fieldset>
        <legend className="mb-2 text-sm text-gray-300">Looking for</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {LOOKING_FOR.map((r) => (
            <label key={r.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="looking_for" value={r.value} defaultChecked={initial.looking_for?.includes(r.value)} className="h-4 w-4 accent-green-500" />
              {r.label}
            </label>
          ))}
        </div>
        {err("looking_for")}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm text-gray-300">Links</legend>
        {LINK_KINDS.map((l) => (
          <div key={l.key}>
            <label htmlFor={`link_${l.key}`} className="mb-1 block text-xs text-gray-400">{l.label}</label>
            <input id={`link_${l.key}`} name={`link_${l.key}`} type="url" maxLength={LIMITS.url} defaultValue={initial.links?.[l.key] ?? ""}
              placeholder={l.hosts ? `https://${l.hosts[0]}/…` : "https://"} className={input} />
            {err(l.key)}
          </div>
        ))}
      </fieldset>

      <button type="submit" disabled={pending} className="w-full rounded-xl bg-green-500 px-6 py-3 font-semibold text-black transition hover:bg-green-400 disabled:opacity-60">
        {pending ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}
