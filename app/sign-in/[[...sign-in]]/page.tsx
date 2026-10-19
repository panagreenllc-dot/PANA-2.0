import { SignIn } from "@clerk/nextjs";
import type { Metadata } from "next";
import AuthShell, { clerkAppearance } from "@/components/AuthShell";

export const metadata: Metadata = { title: "Sign in" };

export default function Page() {
  return (
    <AuthShell
      eyebrow="Welcome back"
      title="Sign in to PANA 2.0"
      points={[
        "Share and manage your ideas",
        "Find collaborators in the community",
        "Apply to present at Treasure Coast Tech Con",
      ]}
    >
      <SignIn appearance={clerkAppearance} signUpUrl="/sign-up" fallbackRedirectUrl="/ideas" />
    </AuthShell>
  );
}
