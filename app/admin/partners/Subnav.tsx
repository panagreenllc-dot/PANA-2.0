import Link from "next/link";
export default function Subnav({ active }: { active: "inbox" | "badges" }) {
  const cls = (on: boolean) => `rounded-full px-3 py-1 text-xs ${on ? "bg-green-500 text-black" : "border border-white/15 text-gray-300 hover:bg-white/10"}`;
  return (
    <nav className="mb-6 flex gap-2">
      <Link href="/admin/partners" className={cls(active === "inbox")}>Inquiries, partners &amp; offers</Link>
      <Link href="/admin/partners/badges" className={cls(active === "badges")}>Badges</Link>
    </nav>
  );
}
