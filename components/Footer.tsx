import { currentYear } from "@/lib/datetime";
import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <p>© {currentYear()} PANA 2.0 · Where Community Meets Innovation</p>
        <nav className="flex flex-wrap gap-x-6 gap-y-2">
          <Link href="/ideas" className="hover:text-white">Explore Ideas</Link>
          <Link href="/submit" className="hover:text-white">Submit an Idea</Link>
          <Link href="/incubator" className="hover:text-white">Incubator</Link>
          <Link href="/community" className="hover:text-white">Community</Link>
          <Link href="/techcon" className="hover:text-white">Tech Con</Link>
          <Link href="/about" className="hover:text-white">About</Link>
          <Link href="/terms" className="hover:text-white">Terms</Link>
          <Link href="/privacy" className="hover:text-white">Privacy</Link>
        </nav>
      </div>
    </footer>
  );
}
