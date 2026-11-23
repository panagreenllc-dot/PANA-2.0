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

// ---- Calendar days and Eastern-time input (Phase 3) ----

const dayFmt = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric", year: "numeric" });

/** A calendar day stored as `date` (select it as text, "YYYY-MM-DD"). No time-zone shift: "2027-03-01" → "Mon, Mar 1, 2027". */
export function formatDay(v: string | null | undefined): string {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const d = new Date(`${v}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? "" : dayFmt.format(d);
}

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: SITE_TZ, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
});

function easternParts(d: Date): { y: number; mo: number; da: number; h: number; mi: number } {
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, mo: +p.month, da: +p.day, h: +p.hour % 24, mi: +p.minute };
}

/**
 * Parse an admin's "YYYY-MM-DDTHH:MM" (datetime-local) as Eastern Time, handling daylight saving.
 * Returns null for empty/invalid input. Times inside the spring-forward gap are moved forward an hour.
 */
export function parseEasternLocal(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(v.trim());
  if (!m) return null;
  const [y, mo, da, h, mi] = m.slice(1).map(Number);
  if (mo < 1 || mo > 12 || da < 1 || da > 31 || h > 23 || mi > 59) return null;
  const wall = Date.UTC(y, mo - 1, da, h, mi);
  // ET is UTC-5 or UTC-4. Try both offsets and keep the one whose ET wall clock matches.
  for (const off of [5, 4]) {
    const cand = new Date(wall + off * 3600_000);
    const p = easternParts(cand);
    if (p.y === y && p.mo === mo && p.da === da && p.h === h && p.mi === mi) return cand;
  }
  const gap = new Date(wall + 4 * 3600_000); // nonexistent local time (spring forward)
  return Number.isNaN(gap.getTime()) ? null : gap;
}

/** Inverse of parseEasternLocal, for prefilling datetime-local inputs. */
export function toEasternLocalInput(v: Date | string | null | undefined): string {
  const d = toDate(v);
  if (!d) return "";
  const p = easternParts(d);
  const z = (n: number) => String(n).padStart(2, "0");
  return `${p.y}-${z(p.mo)}-${z(p.da)}T${z(p.h)}:${z(p.mi)}`;
}

const evDay = new Intl.DateTimeFormat("en-US", { timeZone: SITE_TZ, weekday: "long", month: "long", day: "numeric", year: "numeric" });
const evTime = new Intl.DateTimeFormat("en-US", { timeZone: SITE_TZ, hour: "numeric", minute: "2-digit" });

/** Event date and time in ET: { day: "Sunday, May 30, 2027", time: "10:30 AM – 5:00 PM ET" }. Multi-day ranges show both days. */
export function formatEventRange(start: Date | string | null | undefined, end?: Date | string | null): { day: string; time: string } {
  const s = toDate(start);
  if (!s) return { day: "", time: "" };
  const e = toDate(end ?? null);
  const day = evDay.format(s);
  if (!e) return { day, time: `${evTime.format(s)} ET` };
  if (evDay.format(e) !== day) return { day: `${day} – ${evDay.format(e)}`, time: `${evTime.format(s)} – ${evTime.format(e)} ET` };
  return { day, time: `${evTime.format(s)} – ${evTime.format(e)} ET` };
}
