// All user-facing dates render in America/New_York with an "ET" label, on the server, so output is consistent.
export const SITE_TZ = "America/New_York";

const dateFmt = new Intl.DateTimeFormat("en-US", { timeZone: SITE_TZ, month: "short", day: "numeric", year: "numeric" });
const dateTimeFmt = new Intl.DateTimeFormat("en-US", { timeZone: SITE_TZ, month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });

function toDate(v: Date | string | number | null | undefined): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** e.g. "Oct 19, 2026" (Eastern date) */
export function formatDate(v: Date | string | number | null | undefined): string {
  const d = toDate(v);
  return d ? dateFmt.format(d) : "";
}

/** e.g. "Oct 19, 2026, 7:31 PM ET" */
export function formatDateTime(v: Date | string | number | null | undefined): string {
  const d = toDate(v);
  return d ? `${dateTimeFmt.format(d)} ET` : "";
}

/** Current year in Eastern time. */
export function currentYear(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: SITE_TZ, year: "numeric" }).format(now));
}
