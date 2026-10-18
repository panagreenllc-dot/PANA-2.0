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
        "Share your ideas and find collaborators",
        "Access the PANA 2.0 virtual incubator as it launches",
        "Membership is for adults 18 and older",
      ]}
    >
      <SignUp appearance={clerkAppearance} signInUrl="/sign-in" fallbackRedirectUrl="/welcome" />
    </AuthShell>
  );
}
