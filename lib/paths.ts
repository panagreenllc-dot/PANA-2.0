/** Dot-segments like /.git/HEAD or /.env are never pages here: proxy.ts answers a plain 404. /.well-known stays. */
export function isDotPath(pathname: string): boolean {
  let p = pathname;
  try { p = decodeURIComponent(pathname); } catch { /* keep raw */ }
  return p.split("/").some((seg) => seg.startsWith(".") && seg !== ".well-known");
}
