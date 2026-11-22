import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { TERMS_UPDATED_ON } from "@/lib/gate";

export const metadata: Metadata = { title: "Privacy Policy" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated={TERMS_UPDATED_ON}
      sections={[
        { heading: "What we collect", body: (
          <ul className="list-disc space-y-1 pl-6">
            <li>Account information from our sign-in provider, Clerk: your name, email address and profile picture.</li>
            <li>Your confirmation that you are 18 or older, and when you accepted these terms (and which version).</li>
            <li>The profile, ideas and projects you choose to create.</li>
            <li>Collaboration requests you send or receive, and reports you make.</li>
            <li>Incubator applications: the idea you apply with, your answers, and the decision.</li>
            <li>If you use them as they become available: needs you post on your ideas, help offers and requests to partner offers, your incubator access badge (we store only a scrambled copy of its code, plus how many times and when it was last checked), mentor or investor profiles, mentorship and investor requests, and event RSVPs.</li>
            <li>If you contact us through a partner or sponsor form: the organization and contact details you send.</li>
            <li>Your email preferences.</li>
            <li>Basic technical logs needed to run and secure the site.</li>
          </ul>) },
        { heading: "How we use it", body: <p>To run the community and the incubator, review applications, requests and content, keep the site safe, and send the emails you trigger, such as collaboration requests, introductions, application updates and review results. If you opt in, we also email you when incubator applications open or when we post announcements.</p> },
        { heading: "Who can see your information", body: (
          <>
            <p>Ideas follow the visibility you choose for each field: public, members-only or private. Member profiles are visible only to signed-in members, and only after you publish them. Incubator applications are visible only to you and PANA admins, and applying never makes an idea more visible.</p>
            <p>Your email address is never shown on the site. It is shared with another member or partner only when you both agree to an introduction. Partner contact details sent through our forms are seen only by PANA admins. An incubator badge check shows only what a partner needs: that you are an active participant, your first name and last initial, your cohort and the date it is valid through.</p>
          </>) },
        { heading: "We don't handle money", body: <p>PANA doesn&apos;t take payments or give out money or equipment, and we don&apos;t collect bank, payment, tax ID or shipping details on the site. Resources and any sponsorship are arranged directly between you and the partner or sponsor.</p> },
        { heading: "Service providers", body: <p>We use Clerk (sign-in), Neon (database), Vercel (hosting) and Resend (email delivery) to operate the site. We do not sell your personal information.</p> },
        { heading: "One account across PANA apps", body: <p>Your PANA account is also used to sign in to PANA Domino Royale and PANA Sports Connect, and their data is stored with your PANA account. Deleting your PANA account also deletes your data in those apps, such as game progress, tokens and badges.</p> },
        { heading: "Your choices", body: <p>You can edit or unpublish your profile and ideas at any time, withdraw incubator applications and requests, adjust email preferences, and delete your account. Deleting your account removes your profile, ideas, applications, requests and your data in the PANA apps above.</p> },
        { heading: "Retention and security", body: <p>We keep information while your account is active and as needed for safety and legal obligations. We use reasonable safeguards, but no system is perfectly secure.</p> },
        { heading: "Age", body: <p>PANA 2.0 is for adults 18 and older. We don&apos;t knowingly collect information from anyone under 18.</p> },
      ]}
    />
  );
}
