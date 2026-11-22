"use client";

import { useActionState, useState } from "react";
import { STAGES } from "@/lib/ideas";
import { APP_LIMITS, NEEDS, type ApplicationFormState } from "@/lib/incubator";
import { applyAction } from "../actions";

const input = "w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none";

type Idea = { id: string; name: string; status: string; stage: string };

export default function ApplicationForm({ cohortId, ideas }: { cohortId: string; ideas: Idea[] }) {
  const [state, formAction, pending] = useActionState<ApplicationFormState, FormData>(applyAction, {});
  const [preview, setPreview] = useState(false);
  const [seen, setSeen] = useState(state);
  if (state !== seen) { setSeen(state); setPreview(false); } // a server error returns the form to editing
  const v = (state.values ?? {}) as Record<string, unknown>;
  const fe = state.fieldErrors ?? {};
  const err = (k: string) => (fe[k] ? <p className="mt-1 text-sm text-red-400">{fe[k]}</p> : null);
  const [ideaId, setIdeaId] = useState<string>(String(v.project_id ?? ideas[0]?.id ?? ""));
  const selected = ideas.find((i) => i.id === ideaId);
  const needsSel = new Set((v.needs as string[] | undefined) ?? []);

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8"
      onSubmit={(e) => { if (!preview) { e.preventDefault(); if (e.currentTarget.reportValidity()) setPreview(true); } }}>
      {state.error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{state.error}</p>}
      <input type="hidden" name="cohort_id" value={cohortId} />

      <fieldset aria-readonly={preview} className={`space-y-6 ${preview ? "pointer-events-none select-none opacity-80" : ""}`}>
        <div>
          <label htmlFor="project_id" className="mb-2 block text-sm text-gray-300">Which idea are you applying with? *</label>
          <select id="project_id" name="project_id" value={ideaId} onChange={(e) => setIdeaId(e.target.value)} className={input}>
            {ideas.map((i) => <option key={i.id} value={i.id}>{i.name}{i.status !== "approved" ? " (in review)" : ""}</option>)}
          </select>
          {err("project_id")}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="stage" className="mb-2 block text-sm text-gray-300">Stage *</label>
            <select id="stage" name="stage" defaultValue={String(v.stage ?? selected?.stage ?? "concept")} className={input}>
              {STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            {err("stage")}
          </div>
          <div>
            <label htmlFor="weekly_hours" className="mb-2 block text-sm text-gray-300">Hours per week you can commit *</label>
            <input id="weekly_hours" name="weekly_hours" type="number" min={1} max={80} required defaultValue={String(v.weekly_hours ?? "")} className={input} />
            {err("weekly_hours")}
          </div>
        </div>
        <div>
          <label htmlFor="goals" className="mb-2 block text-sm text-gray-300">What do you want to achieve during the program? *</label>
          <textarea id="goals" name="goals" required minLength={APP_LIMITS.goals[0]} maxLength={APP_LIMITS.goals[1]} rows={6}
            defaultValue={String(v.goals ?? "")} placeholder="Your goals for the 12 weeks, and what success looks like." className={input} />
          {err("goals")}
        </div>
        <fieldset>
          <legend className="mb-2 block text-sm text-gray-300">What would help most?</legend>
          <div className="grid gap-2 sm:grid-cols-2">
            {NEEDS.map((n) => (
              <label key={n.value} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="needs" value={n.value} defaultChecked={needsSel.has(n.value)} className="h-4 w-4 accent-green-500" /> {n.label}
              </label>
            ))}
          </div>
          {err("needs")}
        </fieldset>
        <div>
          <label htmlFor="team" className="mb-2 block text-sm text-gray-300">Team (optional)</label>
          <textarea id="team" name="team" maxLength={APP_LIMITS.team} rows={3} defaultValue={String(v.team ?? "")}
            placeholder="Who is working on this with you, and their roles. No contact details, please." className={input} />
          {err("team")}
        </div>
        <div>
          <label htmlFor="link" className="mb-2 block text-sm text-gray-300">Link to a pitch, demo or repo (optional)</label>
          <input id="link" name="link" type="url" maxLength={APP_LIMITS.url} defaultValue={String(v.link ?? "")} placeholder="https://" className={input} />
          {err("link")}
        </div>
        <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4 text-sm">
          <input type="checkbox" name="ack" required className="mt-1 h-4 w-4 accent-green-500" />
          <span>I understand PANA connects participants with mentors, community partners and sponsors, who provide resources directly. PANA itself doesn&apos;t give out money or equipment.</span>
        </label>
        {err("ack")}
      </fieldset>

      {preview ? (
        <div className="space-y-3">
          <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-200">
            Check your answers above. When you submit, PANA admins will review your application.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <button type="submit" disabled={pending} className="rounded-xl bg-green-500 px-6 py-3 font-semibold text-black hover:bg-green-400 disabled:opacity-60">
              {pending ? "Submitting…" : "Submit application"}
            </button>
            <button type="button" onClick={() => setPreview(false)} className="rounded-xl border border-white/20 px-6 py-3 font-semibold hover:bg-white/10">Edit answers</button>
          </div>
        </div>
      ) : (
        <button type="submit" className="w-full rounded-xl bg-green-500 px-6 py-3 font-semibold text-black hover:bg-green-400">Preview application</button>
      )}
    </form>
  );
}
