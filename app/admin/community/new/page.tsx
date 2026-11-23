import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import AdminNotice from "@/components/AdminNotice";
import FeedPostForm from "@/components/FeedPostForm";
import { createFeedAction } from "../actions";

export default async function NewFeedPostPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const { error } = await searchParams;
  return (
    <section>
      <Link href="/admin/community" className="mb-4 inline-block text-sm text-gray-400 hover:text-white">← Community</Link>
      <h2 className="mb-2 text-xl font-semibold">New announcement or event</h2>
      <p className="mb-6 text-sm text-gray-400">Saved as a draft. Publish it from the next screen when it&apos;s ready.</p>
      <AdminNotice error={error} />
      <FeedPostForm action={createFeedAction} submit="Save draft" />
    </section>
  );
}
