"use server";

import { headers } from "next/headers";
import { isLikelyBot, parseInquiry, type InquiryFormState } from "@/lib/partners";
import { submitInquiry } from "@/lib/partners-repo";
import { clientIp, hit } from "@/lib/rate-limit";

/** Public "Become a partner" form. No account needed. Spam control: honeypot + fill-time check + per-IP limit + length limits. */
export async function inquiryAction(_prev: InquiryFormState, fd: FormData): Promise<InquiryFormState> {
  // Bots get the same "thanks" as people, so they learn nothing; nothing is stored or emailed.
  if (isLikelyBot(fd)) return { ok: true };
  const ip = clientIp(await headers());
  if (!hit("inquiry", ip, 3, 60 * 60_000) || !hit("inquiry-day", ip, 6, 24 * 60 * 60_000)) {
    return { error: "Thanks! We've received several messages from you already. Please try again later or email us." };
  }
  const { data, state } = parseInquiry(fd);
  if (!data) return state!;
  try {
    await submitInquiry(data);
  } catch (e) {
    console.error("inquiryAction failed", e);
    return { error: "Something went wrong. Please try again.", values: { ...data } };
  }
  return { ok: true };
}
