"use client";

import Link from "next/link";
import { useActionState } from "react";
import { acceptWelcome, type WelcomeState } from "./actions";

export default function WelcomeForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<WelcomeState, FormData>(acceptWelcome, {});
  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="next" value={next} />
      <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4">
        <input type="checkbox" name="over18" required className="mt-1 h-4 w-4 accent-green-500" />
        <span>I confirm I am <strong>18 years of age or older</strong>.</span>
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-white/10 p-4">
        <input type="checkbox" name="acceptTerms" required className="mt-1 h-4 w-4 accent-green-500" />
        <span>
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="text-green-400 underline hover:text-green-300">Terms of Use</Link> and{" "}
          <Link href="/privacy" target="_blank" className="text-green-400 underline hover:text-green-300">Privacy Policy</Link>.
        </span>
      </label>
      {state.error && <p role="alert" className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300">{state.error}</p>}
      <button type="submit" disabled={pending} className="w-full rounded-xl bg-green-500 px-6 py-3 font-semibold text-black transition hover:bg-green-400 disabled:opacity-60">
        {pending ? "Saving…" : "Continue"}
      </button>
    </form>
  );
}
