// Gate for P3-3 server actions: signed in, 18+/Terms done, not banned, and the CURRENT Terms accepted
// (members on an older version re-accept once on /welcome, then come back). Not a server action itself.
import { redirect } from "next/navigation";
import { getViewerCtx } from "@/lib/members";

export async function phase3Ctx(next: string) {
  const v = await getViewerCtx();
  if (!v.userId) redirect(`/sign-in?redirect_url=${encodeURIComponent(next)}`);
  if (v.status === "needs_welcome" || (v.status === "ok" && !v.termsCurrent)) redirect(`/welcome?next=${encodeURIComponent(next)}`);
  if (v.status !== "ok") redirect("/");
  return v.ctx as typeof v.ctx & { userId: string };
}
