"use client";
// Community board forms (P3-4). Values are echoed back on errors and the form is keyed, so nothing typed is lost.
import Link from "next/link";
import { useActionState } from "react";
import { BOARD_LIMITS, POST_KINDS } from "@/lib/community";
import type { BoardState } from "@/app/community/board/actions";

const inp = "mt-1 w-full rounded-xl border border-white/10 bg-black px-4 py-3 text-white placeholder:text-gray-500 focus:border-green-400 focus:outline-none";
const btn = "rounded-xl bg-green-500 px-5 py-3 font-semibold text-black hover:bg-green-400 disabled:opacity-60";

export function PostForm({ action }: { action: (s: BoardState, fd: FormData) => Promise<BoardState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values ?? {};
  return (
    <div>
      {state.ok && (
        <p role="status" className="mb-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {state.pending
            ? "Thanks! Your first post is waiting for a quick review by the PANA team. After that, your posts appear straight away."
            : "Posted."}{" "}
          {state.id && <Link href={`/community/board/${state.id}`} className="underline">View it</Link>}
        </p>
      )}
      <form action={formAction} key={state.n ?? 0} className="space-y-3">
        <fieldset>
          <legend className="text-sm text-gray-300">What kind of post?</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {POST_KINDS.map((k) => (
              <label key={k.value} className="flex cursor-pointer items-center gap-2 rounded-full border border-white/15 px-3 py-1.5 text-sm has-[:checked]:border-green-500 has-[:checked]:bg-green-500/15">
                <input type="radio" name="kind" value={k.value} defaultChecked={(v.kind || "question") === k.value} className="accent-green-500" /> {k.label}
              </label>
            ))}
          </div>
        </fieldset>
        <label className="block text-sm text-gray-300">Title
          <input name="title" required minLength={BOARD_LIMITS.title[0]} maxLength={BOARD_LIMITS.title[1]} defaultValue={v.title ?? ""} placeholder="e.g. Looking for 5 people to test my study app" className={inp} />
        </label>
        <label className="block text-sm text-gray-300">Details <span className="text-gray-500">({BOARD_LIMITS.body[0]}–{BOARD_LIMITS.body[1]} characters, no contact details or money amounts)</span>
          <textarea name="body" required minLength={BOARD_LIMITS.body[0]} maxLength={BOARD_LIMITS.body[1]} rows={5} defaultValue={v.body ?? ""} className={inp} />
        </label>
        {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        <button disabled={pending} className={btn}>{pending ? "Posting…" : "Post to the board"}</button>
      </form>
    </div>
  );
}

export function ReplyForm({ action }: { action: (s: BoardState, fd: FormData) => Promise<BoardState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <div>
      {state.ok && (
        <p role="status" className="mb-3 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {state.pending ? "Thanks! Your first reply is waiting for a quick review by the PANA team." : "Reply posted."}
        </p>
      )}
      <form action={formAction} key={state.n ?? 0} className="space-y-3">
        <label className="block text-sm text-gray-300">Your reply <span className="text-gray-500">(no contact details or money amounts)</span>
          <textarea name="body" required minLength={BOARD_LIMITS.reply[0]} maxLength={BOARD_LIMITS.reply[1]} rows={3} defaultValue={state.values?.body ?? ""} className={inp} />
        </label>
        {state.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        <button disabled={pending} className={btn}>{pending ? "Sending…" : "Reply"}</button>
      </form>
    </div>
  );
}
