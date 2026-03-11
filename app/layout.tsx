import "./globals.css";

export const metadata = {
  title: "PANA 2.0",
  description: "A community-driven platform for builders, innovators, and startups.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <header className="sticky top-0 z-50 border-b border-white/10 bg-black/80 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <a href="/" className="text-xl font-bold tracking-wide">
              PANA 2.0
            </a>

            <nav className="hidden gap-6 text-sm text-gray-300 md:flex">
              <a href="/" className="hover:text-white">
                Home
              </a>
              <a href="/techcon" className="hover:text-white">
                Tech Con
              </a>
              <a href="/projects" className="hover:text-white">
                Projects
              </a>
            </nav>

            <a
              href="/submit-project"
              className="rounded-2xl bg-green-500 px-6 py-3 text-base font-bold text-black transition hover:bg-green-400"
            >
              Join Now
            </a>
          </div>
        </header>

        {children}
      </body>
    </html>
  );
}