import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="October 19, 2026"
      sections={[
        { heading: "What we collect", body: (
          <ul className="list-disc space-y-1 pl-6">
            <li>Account information from our sign-in provider, Clerk: your name, email address and profile picture.</li>
            <li>Your confirmation that you are 18 or older, and when you accepted these terms.</li>
            <li>The profile, ideas and projects you choose to create.</li>
            <li>Collaboration requests you send or receive, and reports you make.</li>
            <li>Basic technical logs needed to run and secure the site.</li>
          </ul>) },
        { heading: "How we use it", body: <p>To run the community, review and moderate content, keep the site safe, and send the emails you trigger, such as collaboration requests, introductions and review results.</p> },
        { heading: "Who can see your information", body: <p>Ideas follow the visibility you choose for each field: public, members-only or private. Member profiles are visible only to signed-in members, and only after you publish them. Your email address is never shown on the site. It is shared with another member only when an introduction is accepted.</p> },
        { heading: "Service providers", body: <p>We use Clerk (sign-in), Neon (database), Vercel (hosting) and, once enabled, Resend (email delivery) to operate the site. We do not sell your personal information.</p> },
        { heading: "Your choices", body: <p>You can edit or unpublish your profile and ideas at any time, adjust email preferences, and delete your account. Deleting your account removes your profile, ideas and collaboration requests.</p> },
        { heading: "Retention and security", body: <p>We keep information while your account is active and as needed for safety and legal obligations. We use reasonable safeguards, but no system is perfectly secure.</p> },
        { heading: "Age", body: <p>PANA 2.0 is for adults 18 and older. We don&apos;t knowingly collect information from anyone under 18.</p> },
      ]}
    />
  );
}
