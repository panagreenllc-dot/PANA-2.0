import type { Metadata } from "next";
import RequestDetail from "@/components/RequestDetail";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Investor interest", robots: { index: false, follow: false } };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ notice?: string }> }) {
  const [{ id }, { notice }] = await Promise.all([params, searchParams]);
  return <RequestDetail kind="investor" id={id} notice={notice} />;
}
