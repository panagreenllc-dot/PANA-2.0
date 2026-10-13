import "./globals.css";
import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://panagreen.org"),
  title: { default: "PANA 2.0", template: "%s · PANA 2.0" },
  description:
    "PANA 2.0 is a Treasure Coast community for founders, builders and innovators — showcase projects and join PANA Tech Con.",
  openGraph: { siteName: "PANA 2.0", url: "https://panagreen.org" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
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
