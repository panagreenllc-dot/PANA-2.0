import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://panagreen.org"),
  title: { default: "PANA 2.0", template: "%s · PANA 2.0" },
  description:
    "Where Community Meets Innovation. PANA 2.0 is a community-powered innovation ecosystem and virtual startup incubator connecting developers, entrepreneurs, creators, mentors and investors.",
  openGraph: { siteName: "PANA 2.0", url: "https://panagreen.org" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <body className="flex min-h-screen flex-col bg-black text-white antialiased">
        <ClerkProvider>
          <Header />
          <div className="flex-1">{children}</div>
          <Footer />
        </ClerkProvider>
      </body>
    </html>
  );
}
