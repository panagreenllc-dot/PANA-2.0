import { CONTACT_EMAIL } from "@/lib/site";

export type LegalSection = { heading: string; body: React.ReactNode };

export default function LegalPage({ title, lastUpdated, sections }: { title: string; lastUpdated: string; sections: LegalSection[] }) {
  return (
    <main className="mx-auto max-w-3xl px-6 py-20">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">PANA 2.0 · Effective / Last updated: {lastUpdated}</p>
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
