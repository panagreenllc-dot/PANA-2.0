import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tech Con",
  description: "PANA Tech Con — talks, startup showcases and pitches on the Treasure Coast, Florida.",
};

// ---------------------------------------------------------------------------
// PLACEHOLDERS — replace with real event details before launch.
// ---------------------------------------------------------------------------
const EVENT = {
  date: "Sunday, February 21, 2027",
  time: "Time TBA", // PLACEHOLDER e.g. "9:00 AM – 5:00 PM"
  location: "Treasure Coast, Florida",
  venue: "Havert L. Fenn Center",
  address: "2000 Virginia Avenue, Fort Pierce, FL 34982",
  registrationUrl: "", // PLACEHOLDER: paste the registration link (Eventbrite, Luma, etc.)
};

const MAPS_URL = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${EVENT.venue}, ${EVENT.address}`,
)}`;

const AGENDA: { time: string; title: string }[] = [
  // PLACEHOLDER agenda — replace with the real schedule
  { time: "TBA", title: "Doors open & check-in" },
  { time: "TBA", title: "Opening keynote" },
  { time: "TBA", title: "Startup showcase" },
  { time: "TBA", title: "Founder pitch session" },
  { time: "TBA", title: "Networking & close" },
];

const SPEAKERS: { name: string; role: string }[] = [
  // PLACEHOLDER — add confirmed speakers, e.g. { name: "Jane Doe", role: "Founder, Acme" }
];

const FAQ = [
  { q: "Who should attend?", a: "Founders, developers, students, investors and anyone building in tech on the Treasure Coast." },
  { q: "How do I present my project?", a: "Submit your project and mention Tech Con in the description. Our team reviews every submission and will contact selected presenters." },
  { q: "How much does it cost?", a: "Ticket details will be announced with registration." }, // PLACEHOLDER
];

const HIGHLIGHTS = [
  { title: "Startup showcase", body: "Local founders demo products and prototypes to the community." },
  { title: "Pitch session", body: "Selected teams pitch to mentors, partners and potential investors." },
  { title: "Talks", body: "Practical sessions from operators and engineers building today." },
  { title: "Networking", body: "Meet collaborators, hires and partners from across the region." },
];

export default function TechConPage() {
  return (
    <main>
      <section className="border-b border-white/10">
        <div className="mx-auto max-w-6xl px-6 pb-20 pt-24">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">PANA Tech Con</p>
          <h1 className="mb-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
            The Treasure Coast&apos;s gathering for builders
          </h1>
          <p className="mb-10 max-w-2xl text-lg text-gray-400">
            A one-day conference of talks, live demos and startup pitches connecting
            founders, engineers, students and investors.
          </p>
          <dl className="mb-10 grid max-w-3xl gap-6 sm:grid-cols-3">
            <div className="border-l border-green-400/50 pl-4">
              <dt className="text-xs uppercase tracking-wider text-gray-500">Date</dt>
              <dd className="mt-1 font-medium">{EVENT.date}</dd>
            </div>
            <div className="border-l border-green-400/50 pl-4">
              <dt className="text-xs uppercase tracking-wider text-gray-500">Time</dt>
              <dd className="mt-1 font-medium">{EVENT.time}</dd>
            </div>
            <div className="border-l border-green-400/50 pl-4">
              <dt className="text-xs uppercase tracking-wider text-gray-500">Venue</dt>
              <dd className="mt-1 font-medium">
                <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-4 hover:text-green-300">
                  {EVENT.venue}
                </a>
                <span className="mt-1 block text-sm font-normal text-gray-400">{EVENT.address}</span>
                <span className="block text-sm font-normal text-gray-400">{EVENT.location}</span>
              </dd>
            </div>
          </dl>
          <div className="flex flex-col gap-3 sm:flex-row">
            {EVENT.registrationUrl ? (
              <a href={EVENT.registrationUrl} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-green-500 px-6 py-3 text-center font-semibold text-black transition hover:bg-green-400">
                Register
              </a>
            ) : (
              <span className="cursor-not-allowed rounded-xl bg-green-500/40 px-6 py-3 text-center font-semibold text-black/70">
                Registration opens soon
              </span>
            )}
            <Link href="/submit-project" className="rounded-xl border border-white/20 px-6 py-3 text-center font-semibold transition hover:bg-white hover:text-black">
              Apply to present
            </Link>
          </div>
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
          <p className="mb-6 text-sm text-gray-500">Full schedule to be announced.</p>
          <ol className="divide-y divide-white/10 border-y border-white/10">
            {AGENDA.map((a, i) => (
              <li key={i} className="flex gap-6 py-4">
                <span className="w-16 shrink-0 text-sm text-gray-500">{a.time}</span>
                <span>{a.title}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h2 className="mb-2 text-2xl font-semibold">Speakers</h2>
          {SPEAKERS.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-white/15 p-8 text-gray-400">
              Speakers will be announced soon. Interested in speaking?{" "}
              <Link href="/submit-project" className="text-green-400 hover:text-green-300">Apply to present</Link>.
            </p>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {SPEAKERS.map((s) => (
                <li key={s.name} className="rounded-2xl border border-white/10 p-5">
                  <p className="font-semibold">{s.name}</p>
                  <p className="text-sm text-gray-400">{s.role}</p>
                </li>
              ))}
            </ul>
          )}
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
