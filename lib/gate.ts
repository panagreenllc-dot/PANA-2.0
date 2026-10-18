// Pure membership-gate logic (no I/O) so it can be unit-tested.
// D3/D4: members must confirm they are 18+ and accept the Terms before they can
// submit ideas, create a profile, view members or send collaboration requests.

export const TERMS_VERSION = "2026-10-draft";

export type MemberRecord = {
  age_attested_at: Date | string | null;
  terms_accepted_at: Date | string | null;
  terms_version: string | null;
  status: string;
} | null;

export type GateStatus = "anon" | "banned" | "needs_welcome" | "ok";

export function gateStatus(input: { userId: string | null; banned?: boolean; member: MemberRecord }): GateStatus {
  if (!input.userId) return "anon";
  if (input.banned || (input.member && input.member.status !== "active")) return "banned";
  const m = input.member;
  if (!m || !m.age_attested_at || !m.terms_accepted_at || !m.terms_version) return "needs_welcome";
  return "ok";
}

/** Only allow same-site relative paths as post-welcome / post-sign-in destinations. */
export function safeNext(raw: unknown, fallback = "/ideas"): string {
  if (typeof raw !== "string") return fallback;
  const s = raw.trim();
  if (!s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || s.includes("://")) return fallback;
  if (s.startsWith("/welcome") || s.startsWith("/sign-in") || s.startsWith("/sign-up") || s.startsWith("/api/")) return fallback;
  if (/[\u0000-\u001f]/.test(s) || s.length > 300) return fallback;
  return s;
}

export type WelcomeInput = { over18: boolean; acceptTerms: boolean };

export function parseWelcome(formData: FormData): { ok: true } | { ok: false; error: string } {
  const over18 = formData.get("over18") === "on";
  const acceptTerms = formData.get("acceptTerms") === "on";
  if (!over18) return { ok: false, error: "PANA 2.0 membership is for adults 18 and older. Please confirm you are 18 or older." };
  if (!acceptTerms) return { ok: false, error: "Please agree to the Terms of Use and Privacy Policy to continue." };
  return { ok: true };
}
