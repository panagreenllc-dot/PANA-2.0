import { CONTACT_EMAIL } from "@/lib/site";

export type LegalSection = { heading: string; body: React.ReactNode };

export default function LegalPage({ title, version, sections }: { title: string; version: string; sections: LegalSection[] }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <div role="note" className="mb-10 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm text-yellow-200">
        <strong>DRAFT, pending review.</strong> This page is a draft for the PANA 2.0 owner and legal review. It is not
        final and may change before launch.
      </div>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">PANA 2.0 · Draft version {version}</p>
      <h1 className="mb-10 text-4xl font-bold tracking-tight">{title}</h1>
      <div className="space-y-8 text-gray-300">
        {sections.map((s, i) => (
          <section key={s.heading}>
            <h2 className="mb-2 text-xl font-semibold text-white">{i + 1}. {s.heading}</h2>
            <div className="space-y-3 leading-relaxed">{s.body}</div>
          </section>
        ))}
        <section>
          <h2 className="mb-2 text-xl font-semibold text-white">Contact</h2>
          <p>Questions? Email <a className="text-green-400 underline" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </section>
      </div>
    </main>
  );
}
