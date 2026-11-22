import Link from "next/link";

export default function ThanksPage() {
  return (
    <main className="mx-auto max-w-xl px-6 py-32 text-center">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Submitted</p>
      <h1 className="mb-4 text-4xl font-bold tracking-tight">Thanks — your idea is pending review</h1>
      <p className="mb-10 text-gray-400">
        Our team reviews every submission. Once approved, it will appear on the Explore Ideas page. You can edit it or check its status anytime from My PANA.
      </p>
      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link href="/ideas" className="rounded-xl border border-white/20 px-6 py-3 font-semibold transition hover:bg-white hover:text-black">
          Explore ideas
        </Link>
        <Link href="/incubator/apply" className="rounded-xl border border-green-500/40 px-6 py-3 font-semibold text-green-300 transition hover:bg-green-500/10">
          Applying to the incubator? Continue
        </Link>
      </div>
    </main>
  );
}
