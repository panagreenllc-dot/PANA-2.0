import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { safeNext } from "@/lib/gate";
import { getViewer } from "@/lib/members";
import WelcomeForm from "./WelcomeForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Welcome", robots: { index: false } };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next: rawNext } = await searchParams;
  const next = safeNext(rawNext);
  const viewer = await getViewer();
  if (viewer.status === "anon") redirect(`/sign-in?redirect_url=${encodeURIComponent(`/welcome?next=${next}`)}`);
  if (viewer.status === "ok") redirect(next);
  if (viewer.status === "banned") redirect("/");

  return (
    <main className="mx-auto max-w-xl px-6 py-20">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">Welcome to PANA 2.0</p>
      <h1 className="mb-3 text-4xl font-bold tracking-tight">One quick step</h1>
      <p className="mb-8 text-gray-400">
        PANA 2.0 is a community for adults 18 and older, with a college focus. Please confirm the following to
        submit ideas and take part in the member community.
      </p>
      <WelcomeForm next={next} />
    </main>
  );
}
