import { SignUp } from "@clerk/nextjs";
import type { Metadata } from "next";
import AuthShell, { clerkAppearance } from "@/components/AuthShell";

export const metadata: Metadata = { title: "Join now" };

export default function Page() {
  return (
    <AuthShell
      eyebrow="Join the community"
      title="Join PANA 2.0 — it's free"
      points={[
        "Showcase your startup, app or idea on the Projects page",
        "Get first access to PANA Tech Con registration and pitch slots",
        "Meet founders, engineers and investors on the Treasure Coast",
      ]}
    >
      <SignUp appearance={clerkAppearance} signInUrl="/sign-in" />
    </AuthShell>
  );
}
