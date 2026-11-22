// Pure membership-gate logic (no I/O) so it can be unit-tested.
// D3/D4: members must confirm they are 18+ and accept the Terms before they can
// submit ideas, create a profile, view members or send collaboration requests.

// Current Terms/Privacy version. Members who accepted an older version keep using everything they could before;
// they're asked to accept this version the first time they use a Phase 3 feature (see termsCurrent / requireMember).
export const TERMS_VERSION = "2026-12";
/** Shown on /terms, /privacy and in the update banner. */
export const TERMS_UPDATED_ON = "December 2026";

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

/** True when the member accepted the CURRENT Terms version (compares the version, not just "accepted something"). */
export function termsCurrent(member: MemberRecord, current = TERMS_VERSION): boolean {
  return !!member && !!member.terms_accepted_at && member.terms_version === current;
}

/** A gated member who accepted an older Terms version: show the banner, and re-ask before Phase 3 features. */
export function needsTermsUpdate(status: GateStatus, member: MemberRecord, current = TERMS_VERSION): boolean {
  return status === "ok" && !termsCurrent(member, current);
}

/** Re-acceptance of updated Terms (age was already confirmed at sign-up). */
export function parseTermsUpdate(formData: FormData): { ok: true } | { ok: false; error: string } {
  if (formData.get("acceptTerms") !== "on") return { ok: false, error: "Please agree to the updated Terms of Use and Privacy Policy to continue." };
  return { ok: true };
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
