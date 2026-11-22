"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMember } from "@/lib/members";
import { parseUuid } from "@/lib/incubator";
import { rotateMyBadge } from "@/lib/partners-repo";

export async function newBadgeCodeAction(fd: FormData) {
  const { userId } = await requireMember("/me/badge", { currentTerms: true });
  const id = parseUuid(fd.get("id"));
  const ok = id ? await rotateMyBadge(userId, id) : false;
  revalidatePath("/me/badge");
  redirect(`/me/badge?notice=${ok ? "new-code" : "error"}`);
}
