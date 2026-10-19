"use client";

import { useActionState } from "react";
import { CATEGORIES, type FormState, type ProjectInput } from "@/lib/projects";

const input =
  "w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none";

export default function ProjectForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  initial?: Partial<ProjectInput>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = { ...initial, ...state.values };
  const fe = state.fieldErrors ?? {};

  const err = (k: keyof ProjectInput) =>
    fe[k] ? <p className="mt-1 text-sm text-red-400">{fe[k]}</p> : null;

  return (
    <form action={formAction} className="space-y-6 rounded-2xl border border-white/10 bg-white/[0.03] p-8">
      {state.error && (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          Saved.
        </p>
      )}
      <div>
        <label htmlFor="project_name" className="mb-2 block text-sm text-gray-300">Project name *</label>
        <input id="project_name" name="project_name" required maxLength={80} defaultValue={v.project_name} placeholder="Startup or app name" className={input} />
        {err("project_name")}
      </div>
      <div>
        <label htmlFor="category" className="mb-2 block text-sm text-gray-300">Category *</label>
        <select id="category" name="category" required defaultValue={v.category ?? CATEGORIES[0]} className={input}>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        {err("category")}
      </div>
      <div>
        <label htmlFor="description" className="mb-2 block text-sm text-gray-300">Description * <span className="text-gray-500">(30–1000 characters)</span></label>
        <textarea id="description" name="description" required minLength={30} maxLength={1000} rows={5} defaultValue={v.description} placeholder="What are you building, and who is it for?" className={input} />
        {err("description")}
      </div>
      <div>
        <label htmlFor="website" className="mb-2 block text-sm text-gray-300">Website or GitHub</label>
        <input id="website" name="website" type="url" maxLength={300} defaultValue={v.website} placeholder="https://github.com/your-project" className={input} />
        {err("website")}
      </div>
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-green-500 px-6 py-3 font-semibold text-black transition hover:bg-green-400 disabled:opacity-60">
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
