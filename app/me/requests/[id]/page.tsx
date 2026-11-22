import type { Metadata } from "next";
import RequestDetail from "@/components/RequestDetail";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Collaboration request", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  return <RequestDetail kind="collab" id={id} notice={notice} />;
}
