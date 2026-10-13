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
        "Submit and manage your projects",
        "Apply to present at PANA Tech Con",
        "Connect with Treasure Coast builders",
      ]}
    >
      <SignIn appearance={clerkAppearance} signUpUrl="/sign-up" />
    </AuthShell>
  );
}
