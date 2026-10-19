"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import sql from "@/lib/db";
import { getViewerCtx } from "@/lib/members";
import { respondToRequest, retryIntro, withdrawRequest, expireStale } from "@/lib/ideas-repo";

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

export async function respondAction(fd: FormData) {
  const ctx = await gated();
  const id = reqId(fd);
  const to = fd.get("decision") === "accept" ? "accepted" : "declined";
  await expireStale();
  const r = await respondToRequest(id, ctx.userId!, to);
  revalidatePath("/me");
  if (!r.ok) redirect(`/me/requests/${id}?notice=unavailable`);
  if (r.status === "accepted") redirect(`/me/requests/${id}?notice=${r.intro?.sent ? "intro-sent" : "intro-failed"}`);
  redirect(`/me/requests/${id}?notice=declined`);
}

export async function retryIntroAction(fd: FormData) {
  const ctx = await gated();
  const id = reqId(fd);
  const r = await retryIntro(id, ctx.userId!, ctx.isAdmin);
  revalidatePath("/me");
  redirect(`/me/requests/${id}?notice=${r?.sent ? "intro-sent" : "intro-failed"}`);
}

export async function withdrawRequestAction(fd: FormData) {
  const ctx = await gated();
  const id = reqId(fd);
  await withdrawRequest(id, ctx.userId!);
  revalidatePath("/me");
  redirect(`/me/requests/${id}?notice=withdrawn`);
}

export async function emailPrefsAction(fd: FormData) {
  const ctx = await gated();
  const prefs = { requests: fd.get("requests") === "on", reviews: fd.get("reviews") === "on" };
  await sql`UPDATE members SET email_prefs = ${JSON.stringify(prefs)}::jsonb, updated_at = now() WHERE user_id = ${ctx.userId}`;
  revalidatePath("/me");
  redirect("/me?saved=prefs");
}
