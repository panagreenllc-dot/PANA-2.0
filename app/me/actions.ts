"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { getViewerCtx } from "@/lib/members";
import * as R from "@/lib/requests-repo";
import { isRequestKind, KIND_INFO, type RequestKind } from "@/lib/requests";

async function gated() {
  const { ctx } = await getViewerCtx();
  if (!ctx.userId) redirect("/sign-in?redirect_url=/me");
  if (ctx.status !== "ok") redirect("/welcome?next=/me");
  return ctx;
}

function reqId(fd: FormData): string {
  const id = String(fd.get("id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/me");
  return id.toLowerCase();
}

/** Every request kind (collaboration, help offer, offer request) shares these actions; the form posts its kind. */
function reqKind(fd: FormData): RequestKind {
  const k = fd.get("kind") ?? "collab";
  return isRequestKind(k) ? k : "collab";
}

export async function respondAction(fd: FormData) {
  const ctx = await gated();
  const id = reqId(fd);
  const kind = reqKind(fd);
  const to = fd.get("decision") === "accept" ? "accepted" : "declined";
  await R.expireAll();
  const r = await R.respond(kind, id, ctx.userId!, to, ctx.isAdmin);
  revalidatePath("/me");
  const path = KIND_INFO[kind].path(id);
  if (!r.ok) redirect(`${path}?notice=unavailable`);
  if (r.status === "accepted") redirect(`${path}?notice=${r.intro?.sent ? "intro-sent" : "intro-failed"}`);
  redirect(`${path}?notice=declined`);
}

export async function retryIntroAction(fd: FormData) {
  const ctx = await gated();
  const id = reqId(fd);
  const kind = reqKind(fd);
  const r = await R.retryIntro(kind, id, ctx.userId!, ctx.isAdmin);
  revalidatePath("/me");
  redirect(`${KIND_INFO[kind].path(id)}?notice=${r?.sent ? "intro-sent" : "intro-failed"}`);
}

export async function withdrawRequestAction(fd: FormData) {
  const ctx = await gated();
  const id = reqId(fd);
  const kind = reqKind(fd);
  await R.withdraw(kind, id, ctx.userId!);
  revalidatePath("/me");
  redirect(`${KIND_INFO[kind].path(id)}?notice=withdrawn`);
}

export async function emailPrefsAction(fd: FormData) {
  const ctx = await gated();
  const prefs = {
    requests: fd.get("requests") === "on", reviews: fd.get("reviews") === "on",
    incubator: fd.get("incubator") === "on", incubator_news: fd.get("incubator_news") === "on",
  };
  // Merge so keys added later (or by other features) are never wiped.
  await sql`UPDATE members SET email_prefs = coalesce(email_prefs, '{}'::jsonb) || ${JSON.stringify(prefs)}::jsonb, updated_at = now()
            WHERE user_id = ${ctx.userId}`;
  revalidatePath("/me");
  redirect("/me?saved=prefs");
}
