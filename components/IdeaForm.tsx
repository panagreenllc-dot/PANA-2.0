"use client";

import { useActionState } from "react";
import { AUDIENCES, CATEGORIES, FIELD_LEVELS, HELP_NEEDED, KINDS, LIMITS, STAGES, type IdeaFormState, type IdeaInput } from "@/lib/ideas";

const input = "w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none";
const small = "rounded-lg border border-white/10 bg-black px-3 py-2 text-sm text-white";

function Vis({ name, value }: { name: string; value?: string }) {
  return (
    <select name={name} defaultValue={value} aria-label="Who can see this field" className={small}>
      {FIELD_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
    </select>
  );
}

export default function IdeaForm({ action, initial, submitLabel, note }: {
  action: (s: IdeaFormState, fd: FormData) => Promise<IdeaFormState>;
  initial?: Partial<IdeaInput>;
  submitLabel: string;
  note?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v: Partial<IdeaInput> = { ...initial, ...state.values };
  const fv = { details: "members", website: "public", help_needed: "public", ...(v.field_visibility ?? {}) };
  const fe = (state.fieldErrors ?? {}) as Record<string, string>;
  const err = (k: string) => (fe[k] ? <p className="mt-1 text-sm text-red-400">{fe[k]}</p> : null);

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
      {state.error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      {state.ok && <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">{state.notice ?? "Saved."}</p>}
      {note && <p className="text-sm text-gray-400">{note}</p>}

      <div>
        <label htmlFor="project_name" className="mb-2 block text-sm text-gray-300">Name *</label>
        <input id="project_name" name="project_name" required maxLength={LIMITS.name[1]} defaultValue={v.project_name} placeholder="Idea, project or startup name" className={input} />
        {err("project_name")}
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="category" className="mb-2 block text-sm text-gray-300">Category *</label>
          <select id="category" name="category" defaultValue={v.category ?? CATEGORIES[0]} className={input}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
          {err("category")}
        </div>
        <div>
          <label htmlFor="kind" className="mb-2 block text-sm text-gray-300">Type</label>
          <select id="kind" name="kind" defaultValue={v.kind ?? "idea"} className={input}>{KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          {err("kind")}
        </div>
        <div>
          <label htmlFor="stage" className="mb-2 block text-sm text-gray-300">Stage</label>
          <select id="stage" name="stage" defaultValue={v.stage ?? "concept"} className={input}>{STAGES.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}</select>
          {err("stage")}
        </div>
      </div>
      <div>
        <label htmlFor="description" className="mb-2 block text-sm text-gray-300">Short description * <span className="text-gray-500">(30–1000 characters, shown on the idea card)</span></label>
        <textarea id="description" name="description" required minLength={LIMITS.description[0]} maxLength={LIMITS.description[1]} rows={4} defaultValue={v.description} placeholder="What are you building, and who is it for?" className={input} />
        {err("description")}
      </div>
      <div>
        <label htmlFor="audience" className="mb-2 block text-sm text-gray-300">Who can see this idea card?</label>
        <select id="audience" name="audience" defaultValue={v.audience ?? "public"} className={input}>{AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}</select>
        {err("audience")}
      </div>

      <div className="rounded-xl border border-white/10 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="details" className="text-sm text-gray-300">Details <span className="text-gray-500">(optional: pitch, plan, traction)</span></label>
          <Vis name="vis_details" value={fv.details} />
        </div>
        <textarea id="details" name="details" rows={6} maxLength={LIMITS.details} defaultValue={v.details} placeholder="Anything you want members to know. Use Private for anything confidential." className={input} />
        {err("details")}{err("vis_details")}
      </div>
      <div className="rounded-xl border border-white/10 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="website" className="text-sm text-gray-300">Website or GitHub</label>
          <Vis name="vis_website" value={fv.website} />
        </div>
        <input id="website" name="website" type="url" maxLength={LIMITS.url} defaultValue={v.website} placeholder="https://github.com/your-project" className={input} />
        {err("website")}{err("vis_website")}
      </div>
      <fieldset className="rounded-xl border border-white/10 p-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <legend className="text-sm text-gray-300">Help needed</legend>
          <Vis name="vis_help_needed" value={fv.help_needed} />
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {HELP_NEEDED.map((h) => (
            <label key={h.value} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="help_needed" value={h.value} defaultChecked={v.help_needed?.includes(h.value)} className="h-4 w-4 accent-green-500" />
              {h.label}
            </label>
          ))}
        </div>
        {err("help_needed")}{err("vis_help_needed")}
      </fieldset>
      <p className="text-xs text-gray-500">Public = anyone. Members only = signed-in PANA members. Private = only you and PANA admins. Don&apos;t include emails or phone numbers; members contact you through PANA.</p>

      <button type="submit" disabled={pending} className="w-full rounded-xl bg-green-500 px-6 py-3 font-semibold text-black transition hover:bg-green-400 disabled:opacity-60">
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
