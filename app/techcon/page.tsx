import Link from "next/link";
import type { Metadata } from "next";
import EventDetails from "@/components/EventDetails";
import { agendaOf, speakersOf, techcon, type FeedPost } from "@/lib/community-repo";

export const metadata: Metadata = {
  title: "Treasure Coast Tech Con",
  description: "Treasure Coast Tech Con, Sunday, May 30, 2027 in Fort Pierce: talks, startup showcases and pitches on the Treasure Coast, Florida.",
};

// Tech Con reads its event, agenda and speakers from the database (Admin → Community), so John can change the time,
// price, registration link and speakers without a code change. FALLBACK is used only if the database row is missing.
export const dynamic = "force-dynamic";

const FALLBACK: FeedPost = {
  id: "", slug: "treasure-coast-tech-con-2027", kind: "event", program: "techcon", audience: "public", status: "published", pinned: true,
  title: "Treasure Coast Tech Con 2027", body: "", starts_at: "2027-05-30T14:30:00Z", ends_at: "2027-05-30T21:00:00Z",
  location_name: "Havert L. Fenn Center", address: "2000 Virginia Avenue, Fort Pierce, FL 34982", is_online: false,
  registration_url: null, registration_note: "Registration opens soon", price_text: "To be announced", published_at: null, created_at: "", updated_at: "",
};
const FALLBACK_SPEAKERS = [{ name: "Professor Joseph Ali", role: "Keiser University · Guest speaker" }];

const PLACEHOLDER_AGENDA: { time_label: string; title: string }[] = [
  { time_label: "TBA", title: "Doors open & check-in" },
  { time_label: "TBA", title: "Opening keynote" },
  { time_label: "TBA", title: "Startup showcase" },
  { time_label: "TBA", title: "Founder pitch session" },
  { time_label: "TBA", title: "Networking & close" },
];

const priceAnswer = (p: string | null) =>
  !p || /to be announced|tbd|tba/i.test(p) ? "Pricing is to be announced. We'll post it here with registration." : /^free$/i.test(p.trim()) ? "Free." : p;

const faq = (price: string | null) => [
  { q: "Who should attend?", a: "Founders, developers, students, investors and anyone building in tech on the Treasure Coast." },
  { q: "How do I present my project?", a: "Submit your project and mention Tech Con in the description. Our team reviews every submission and will contact selected presenters." },
  { q: "How much does it cost?", a: priceAnswer(price) },
];

const HIGHLIGHTS = [
  { title: "Startup showcase", body: "Local founders demo products and prototypes to the community." },
  { title: "Pitch session", body: "Selected teams pitch to mentors, partners and potential investors." },
  { title: "Talks", body: "Practical sessions from operators and engineers building today." },
  { title: "Networking", body: "Meet collaborators, hires and partners from across the region." },
];

export default async function TechConPage() {
  const row = await techcon().catch(() => null);
  const EVENT = row ?? FALLBACK;
  const [dbAgenda, dbSpeakers] = row ? await Promise.all([agendaOf(row.id).catch(() => []), speakersOf(row.id).catch(() => [])]) : [[], FALLBACK_SPEAKERS];
  const AGENDA = dbAgenda.length ? dbAgenda : PLACEHOLDER_AGENDA;
  const SPEAKERS = dbSpeakers;
  const FAQ = faq(EVENT.price_text);
  return (
    <main>
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-24">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">
            <Link href="/" className="hover:text-green-300">PANA 2.0</Link> · Programs · Treasure Coast Tech Con
          </p>
          <h1 className="mb-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            The Treasure Coast&apos;s gathering for builders
          </h1>
          <p className="mb-10 max-w-2xl text-lg text-gray-400">
            A one-day conference of talks, live demos and startup pitches connecting
            founders, engineers, students and investors.
          </p>
          <EventDetails e={EVENT} calendarHref={`/events/${EVENT.slug}/calendar`} extra={
            <Link href="/submit" className="rounded-xl border border-white/20 px-6 py-3 text-center font-semibold transition hover:bg-white hover:text-black">
              Apply to present
            </Link>} />
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mb-10 text-2xl font-semibold">What to expect</h2>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="bg-black p-8">
              <h3 className="mb-2 font-semibold">{h.title}</h3>
              <p className="text-gray-400">{h.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-16 px-6 pb-20 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-2xl font-semibold">Agenda</h2>
          {!dbAgenda.length && <p className="mb-6 text-sm text-gray-500">Full schedule to be announced.</p>}
          <ol className="divide-y divide-white/10 border-y border-white/10">
            {AGENDA.map((a, i) => (
              <li key={i} className="flex gap-6 py-4">
                <span className="w-20 shrink-0 text-sm text-gray-500">{a.time_label}</span>
                <span>{a.title}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="mb-2 text-2xl font-semibold">Speakers</h2>
          {SPEAKERS.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 p-8 text-gray-400">
              More speakers will be announced soon. Interested in speaking?{" "}
              <Link href="/submit" className="text-green-400 hover:text-green-300">Apply to present</Link>.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {SPEAKERS.map((s) => (
                <li key={s.name + s.role} className="rounded-2xl border border-white/10 p-5">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-gray-400">{s.role}</p>
                </li>
              ))}
            </ul>
          )}
          {SPEAKERS.length > 0 && <p className="mt-4 text-sm text-gray-500">More speakers to be announced.</p>}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-6 pb-24">
        <h2 className="mb-6 text-2xl font-semibold">FAQ</h2>
        <div className="divide-y divide-white/10 border-y border-white/10">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-4">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                {f.q}
              </summary>
              <p className="mt-2 text-gray-400">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </main>
  );
}
