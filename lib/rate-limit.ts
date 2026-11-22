// Tiny in-memory, per-instance rate limiter ($0, no store). Keys are hashed in memory and never stored or logged.
// It is a speed bump for bots, not a guarantee (each serverless instance has its own window).
import { createHash } from "node:crypto";

type Bucket = { n: number; reset: number };
const buckets = new Map<string, Bucket>();

export function hit(scope: string, key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const k = `${scope}:${createHash("sha256").update(key).digest("hex").slice(0, 32)}`;
  if (buckets.size > 5000) for (const [kk, b] of buckets) if (b.reset <= now) buckets.delete(kk);
  const b = buckets.get(k);
  if (!b || b.reset <= now) { buckets.set(k, { n: 1, reset: now + windowMs }); return true; }
  b.n += 1;
  return b.n <= limit;
}

export function clientIp(h: { get(name: string): string | null }): string {
  return (h.get("x-forwarded-for") || "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

export function _resetForTests() { buckets.clear(); }
