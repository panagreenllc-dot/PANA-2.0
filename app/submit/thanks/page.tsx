import Link from "next/link";

export default function ThanksPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-32 text-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Submitted</p>
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Thanks — your idea is pending review</h1>
      <p className="mb-10 text-gray-400">
        Our team reviews every submission. Once approved, it will appear on the Explore Ideas page.
      </p>
      <Link href="/ideas" className="rounded-xl border border-white/20 px-6 py-3 font-semibold transition hover:bg-white hover:text-black">
        Explore ideas
      </Link>
    </main>
  );
}
