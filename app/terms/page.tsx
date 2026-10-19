import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { TERMS_VERSION } from "@/lib/gate";

export const metadata: Metadata = { title: "Terms of Use (draft)", robots: { index: false } };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      version={TERMS_VERSION}
      sections={[
        { heading: "Who can join", body: <p>You must be at least 18 years old to create an account or take part in the PANA 2.0 member community. By joining you confirm that you are 18 or older. We remove accounts of people under 18 when we learn of them.</p> },
        { heading: "Your content", body: <p>You keep ownership of the ideas, projects and profile information you post. You give PANA 2.0 permission to store and display that content according to the visibility settings you choose. Only post content you have the right to share.</p> },
        { heading: "Sharing ideas is at your own risk", body: <p>PANA 2.0 is not a confidentiality agreement (NDA). Don&apos;t put confidential information in public or members-only fields. Use the Private setting, or don&apos;t post it at all.</p> },
        { heading: "Be respectful", body: <p>No spam, harassment, hate, scams, illegal content, or impersonation. We may review, hide or remove content and suspend or delete accounts that break these rules. Members can report content to our team.</p> },
        { heading: "Introductions", body: <p>PANA 2.0 can introduce members to each other, but we don&apos;t vet members or guarantee any outcome. PANA 2.0 is not a broker, investment adviser or funding portal and does not offer or sell securities.</p> },
        { heading: "Moderation", body: <p>Ideas are reviewed before they appear publicly, and edits to public text are reviewed again. We decide what is published at our discretion.</p> },
        { heading: "No warranty; limitation of liability", body: <p>The service is provided &quot;as is&quot; without warranties. To the extent the law allows, PANA 2.0 is not liable for indirect or consequential damages arising from your use of the service or from dealings between members.</p> },
        { heading: "Changes and governing law", body: <p>We may update these terms and will notify members of material changes. Continued use after a change means you accept it. These terms are governed by the laws of the State of Florida.</p> },
      ]}
    />
  );
}
