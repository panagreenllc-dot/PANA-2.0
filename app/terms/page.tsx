import type { Metadata } from "next";
import LegalPage from "@/components/LegalPage";
import { TERMS_UPDATED_ON } from "@/lib/gate";

export const metadata: Metadata = { title: "Terms of Use" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      lastUpdated={TERMS_UPDATED_ON}
      sections={[
        { heading: "Who can join", body: <p>You must be at least 18 years old to create an account or take part in the PANA 2.0 member community. By joining you confirm that you are 18 or older. We remove accounts of people under 18 when we learn of them.</p> },
        { heading: "Your content", body: <p>You keep ownership of the ideas, projects and profile information you post. You give PANA 2.0 permission to store and display that content according to the visibility settings you choose. Only post content you have the right to share.</p> },
        { heading: "Sharing ideas is at your own risk", body: <p>PANA 2.0 is not a confidentiality agreement (NDA). Don&apos;t put confidential information in public or members-only fields. Use the Private setting, or don&apos;t post it at all.</p> },
        { heading: "Be respectful", body: <p>No spam, harassment, hate, scams, illegal content, or impersonation. We may review, hide or remove content and suspend or delete accounts that break these rules. Members can report content to our team.</p> },
        { heading: "Introductions", body: <p>PANA 2.0 can introduce members to each other, but we don&apos;t vet members or guarantee any outcome. PANA 2.0 is not a broker, investment adviser or funding portal and does not offer or sell securities.</p> },
        { heading: "Moderation", body: <p>Ideas are reviewed before they appear publicly, and edits to public text are reviewed again. We decide what is published at our discretion.</p> },
        { heading: "Community board", body: <p>Signed-in members can post questions, requests for help, wins and tips, and reply to each other. Board posts are visible only to signed-in members. Don&apos;t post contact details, money amounts or confidential information, and don&apos;t use the board to sell, solicit payments or fundraise. We review each member&apos;s first post or reply, may hide or remove anything, and content reported by several members is hidden until we review it. Help between members is voluntary and isn&apos;t professional advice.</p> },
        { heading: "Incubator programs", body: <p>You can apply to PANA incubator cohorts with an idea you posted. Acceptance is at PANA&apos;s sole discretion, there is no fixed number of places, and programs may change or end. Decisions are private: we email them to each applicant and never announce them publicly. Taking part isn&apos;t employment, a partnership or an investment, and PANA takes no ownership or equity in your project.</p> },
        { heading: "Partners and resources", body: <p>Resources, access and sponsorships, such as computer lab or library time, software, space, mentorship hours or sponsor funding, are provided directly by community partners, sponsors and members, under their own rules. PANA only connects people. PANA doesn&apos;t give out money, grants or equipment, isn&apos;t a party to and takes no fee from any arrangement between you and a partner or sponsor, and doesn&apos;t guarantee that any offer will be available or suitable. Partner sites such as college labs and libraries have their own rules and hours, which you must follow. Listing a partner isn&apos;t an endorsement.</p> },
        { heading: "Incubator badge", body: <p>If you have an incubator access badge, it is personal and can&apos;t be transferred. It only shows that you are an active participant, and partners may ask for photo ID. PANA can revoke a badge, and sharing or misusing one can lead to removal from the program.</p> },
        { heading: "Needs, help and mentors", body: <p>Don&apos;t post confidential information in a need or request. Help between members is voluntary. Mentors are volunteers, and their guidance isn&apos;t legal, financial, tax or other professional advice. PANA doesn&apos;t vet helpers or supervise mentoring.</p> },
        { heading: "Investors", body: <p>An investor badge means only that PANA approved that person&apos;s request to be listed as an investor. PANA doesn&apos;t vet investors, verify accreditation or check identities, doesn&apos;t take part in or profit from any deal, and nothing on PANA 2.0 is an offer to sell securities. Do your own checks and get professional advice.</p> },
        { heading: "Events", body: <p>Event details can change. You take part in in-person events at your own risk, and our conduct rules apply there too.</p> },
        { heading: "One account across PANA apps", body: <p>Your PANA account also signs you in to PANA Domino Royale and PANA Sports Connect. Deleting your PANA account deletes your data in those apps as well.</p> },
        { heading: "No warranty; limitation of liability", body: <p>The service is provided &quot;as is&quot; without warranties. To the extent the law allows, PANA 2.0 is not liable for indirect or consequential damages arising from your use of the service or from dealings between members.</p> },
        { heading: "Changes and governing law", body: <p>We may update these terms and will notify members of material changes. Continued use after a change means you accept it. These terms are governed by the laws of the State of Florida.</p> },
      ]}
    />
  );
}
