import "./globals.css";
import {
  ClerkProvider,
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";

export const metadata = {
  title: "PANA 2.0",
  description: "Startup community platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-black text-white">
        <ClerkProvider>
          <header className="border-b border-white/10 bg-black/80 backdrop-blur">
            <div className="mx-auto flex max-w-6xl items-center justify-between p-6">
              <a href="/" className="text-xl font-bold">
                PANA 2.0
              </a>

              <nav className="flex gap-6 text-sm text-gray-300">
                <a href="/">Home</a>
                <a href="/techcon">Tech Con</a>
                <a href="/projects">Projects</a>
              </nav>

              <div className="flex items-center gap-3">
                <Show when="signed-out">
                  <SignInButton />
                  <SignUpButton>
                    <button className="rounded-xl bg-green-500 px-5 py-2 font-semibold text-black">
                      Join Now
                    </button>
                  </SignUpButton>
                </Show>

                <Show when="signed-in">
                  <UserButton />
                </Show>
              </div>
            </div>
          </header>

          {children}
        </ClerkProvider>
      </body>
    </html>
  );
}