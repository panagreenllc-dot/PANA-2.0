export default function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: React.ReactNode }) {
  return (
    <section className="border-b border-white/10">
      <div className="mx-auto max-w-6xl px-6 pb-16 pt-24">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">{eyebrow}</p>
        <h1 className="mb-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">{title}</h1>
        {children && <div className="max-w-2xl space-y-4 text-lg text-gray-400">{children}</div>}
      </div>
    </section>
  );
}

export function CardGrid({ items, cols = 3 }: { items: { title: string; body: string }[]; cols?: 2 | 3 | 4 }) {
  const c = { 2: "md:grid-cols-2", 3: "md:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <div className={`grid gap-6 ${c}`}>
      {items.map((i) => (
        <div key={i.title} className="rounded-2xl border border-white/10 bg-white/[0.02] p-6">
          <h3 className="mb-2 font-semibold">{i.title}</h3>
          <p className="text-sm text-gray-400">{i.body}</p>
        </div>
      ))}
    </div>
  );
}

export const btnPrimary = "rounded-xl bg-green-500 px-6 py-3 text-center font-semibold text-black transition hover:bg-green-400";
export const btnSecondary = "rounded-xl border border-white/20 px-6 py-3 text-center font-semibold transition hover:bg-white hover:text-black";
