// Incubator access badge tokens (Phase 3 / P3-2a). Server-only.
// token = base64url(HMAC-SHA256(BADGE_TOKEN_SECRET, nonce))[0..22]  (128 bits). Only sha256(token) is stored, with the nonce.
// The page can rebuild the QR code from the nonce, but a database copy alone can't produce working tokens.
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;

export function badgeSecret(env: Record<string, string | undefined> = process.env): string | null {
  const s = (env.BADGE_TOKEN_SECRET || "").trim();
  return s.length >= 32 ? s : null;
}

export function newNonce(): string {
  return randomBytes(16).toString("hex");
}

export function deriveToken(secret: string, nonce: string): string {
  return createHmac("sha256", secret).update(`pana-badge-v1:${nonce}`).digest("base64url").slice(0, 22);
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sameHash(a: string, b: string): boolean {
  const x = Buffer.from(a, "hex"), y = Buffer.from(b, "hex");
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Who sees "Active": not revoked, not expired, still an active participant of an accepted application, member active. */
export type BadgeRow = {
  revoked_at: Date | string | null; expires_at: Date | string | null; app_status: string;
  participant_status: string | null; member_status: string;
};
export function badgeIsValid(b: BadgeRow | null | undefined, now = new Date()): boolean {
  if (!b) return false;
  if (b.revoked_at) return false;
  if (b.expires_at && new Date(b.expires_at).getTime() <= now.getTime()) return false;
  return b.app_status === "accepted" && b.participant_status === "active" && b.member_status === "active";
}
