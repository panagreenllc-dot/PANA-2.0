// Project ids may be integers (serial/bigint) or UUIDs depending on how the
// Neon table was created. Treat ids as opaque strings: validate the format,
// pass them as text, and compare with `id::text = $1` in SQL so the query
// works regardless of the column type.

const INT_RE = /^[1-9]\d{0,18}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns the normalized id string, or null if it is not an integer or UUID. */
export function parseProjectId(raw: unknown): string | null {
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const s = String(raw).trim();
  if (INT_RE.test(s)) return s;
  if (UUID_RE.test(s)) return s.toLowerCase();
  return null;
}
