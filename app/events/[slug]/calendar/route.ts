// "Add to calendar": a server-made .ics file for one published event (P3-4). Members-only events need a signed-in member.
import { buildIcs } from "@/lib/community";
import { postBySlug } from "@/lib/community-repo";
import { SITE_URL } from "@/lib/email";
import { getViewer } from "@/lib/members";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length > 80) return new Response("Not found", { status: 404 });
  let post = await postBySlug(false, slug);
  if (!post) {
    const v = await getViewer().catch(() => null);
    if (v?.status === "ok") post = await postBySlug(true, slug);
  }
  if (!post || post.kind !== "event" || !post.starts_at) return new Response("Not found", { status: 404 });
  const url = post.program === "techcon" && post.audience === "public" ? `${SITE_URL}/techcon` : `${SITE_URL}/events/${post.slug}`;
  const ics = buildIcs({
    uid: post.id, title: post.title, starts_at: new Date(post.starts_at), ends_at: post.ends_at ? new Date(post.ends_at) : null,
    location: post.is_online && !post.location_name ? "Online" : [post.location_name, post.address].filter(Boolean).join(", ") || null,
    description: post.body, url,
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="${post.slug}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
