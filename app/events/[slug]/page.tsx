import Link from "next/link";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import EventDetails from "@/components/EventDetails";
import { agendaOf, postBySlug, speakersOf } from "@/lib/community-repo";
import { formatDate } from "@/lib/datetime";
import { getViewer } from "@/lib/members";

export const dynamic = "force-dynamic";

async function load(slug: string) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return { post: null, member: false };
  const v = await getViewer().catch(() => null);
  const member = v?.status === "ok";
  return { post: await postBySlug(member, slug), member };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { post } = await load(slug);
  if (!post) return { title: "Event" };
  return { title: post.title, description: post.body.slice(0, 160), ...(post.audience === "members" ? { robots: { index: false, follow: false } } : {}) };
}

export default async function EventPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { post, member } = await load(slug);
  if (!post) {
    // A members-only post: ask visitors to sign in rather than revealing it exists only to members.
    if (!member) {
      const v = await getViewer().catch(() => null);
      if (!v?.userId && /^[a-z0-9-]+$/.test(slug)) {
        const any = await postBySlug(true, slug).catch(() => null);
        if (any) redirect(`/sign-in?redirect_url=${encodeURIComponent(`/events/${slug}`)}`);
      }
    }
    notFound();
  }
  if (post.kind === "event" && post.program === "techcon" && post.audience === "public") redirect("/techcon");
  const [agenda, speakers] = post.kind === "event" ? await Promise.all([agendaOf(post.id), speakersOf(post.id)]) : [[], []];

  return (
    <main className="mx-auto max-w-4xl px-6 py-20">
      <Link href="/community" className="mb-6 inline-block text-sm text-gray-400 hover:text-white">← Community</Link>
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">
        {post.kind === "event" ? "Event" : "Announcement"}{post.audience === "members" ? " · Members only" : ""}
      </p>
      <h1 className="mb-6 text-4xl font-bold tracking-tight">{post.title}</h1>
      {post.kind === "event" ? <EventDetails e={post} calendarHref={`/events/${post.slug}/calendar`} /> : (
        <p className="mb-6 text-sm text-gray-500">Posted {formatDate(post.published_at)}</p>
      )}
      {post.body && <div className="mt-10 max-w-3xl whitespace-pre-line text-gray-300">{post.body}</div>}
      {agenda.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-semibold">Agenda</h2>
          <ol className="divide-y divide-white/10 border-y border-white/10">
            {agenda.map((a, i) => <li key={i} className="flex gap-6 py-4"><span className="w-20 shrink-0 text-sm text-gray-500">{a.time_label}</span><span>{a.title}</span></li>)}
          </ol>
        </section>
      )}
      {speakers.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-2xl font-semibold">Speakers</h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {speakers.map((s, i) => <li key={i} className="rounded-2xl border border-white/10 p-5"><p className="font-semibold">{s.name}</p><p className="text-sm text-gray-400">{s.role}</p></li>)}
          </ul>
        </section>
      )}
      {post.kind === "event" && <p className="mt-12 text-xs text-gray-500">Event details can change. In-person events are at your own risk, and PANA&apos;s conduct rules apply.</p>}
    </main>
  );
}
