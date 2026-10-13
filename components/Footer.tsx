import Link from "next/link";

export default function Footer() {
  return (
    <footer className="border-t border-white/10">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-gray-400 sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} PANA 2.0 · panagreen.org</p>
        <nav className="flex gap-6">
          <Link href="/techcon" className="hover:text-white">Tech Con</Link>
          <Link href="/projects" className="hover:text-white">Projects</Link>
          <Link href="/submit-project" className="hover:text-white">Submit a project</Link>
        </nav>
      </div>
    </footer>
  );
}
