import Link from "next/link";

export const clerkAppearance = {
  variables: {
    colorPrimary: "#22c55e",
    colorBackground: "#0a0a0a",
    colorText: "#ffffff",
    colorTextSecondary: "#9ca3af",
    colorInputBackground: "#000000",
    colorInputText: "#ffffff",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none border border-white/10",
    card: "bg-[#0a0a0a]",
    formButtonPrimary: "bg-green-500 text-black hover:bg-green-400 normal-case",
    footerActionLink: "text-green-400 hover:text-green-300",
  },
};

export default function AuthShell({
  eyebrow,
  title,
  points,
  children,
}: {
  eyebrow: string;
  title: string;
  points: string[];
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto grid max-w-6xl items-center gap-12 px-6 py-16 lg:grid-cols-2 lg:py-24">
      <div className="hidden lg:block">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.3em] text-green-400">{eyebrow}</p>
        <h1 className="mb-8 text-4xl font-bold leading-tight tracking-tight">{title}</h1>
        <ul className="space-y-4 text-gray-300">
          {points.map((p) => (
            <li key={p} className="flex gap-3">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-green-400" />
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-10 text-sm text-gray-500">
          By continuing you agree to keep PANA a respectful, builder-first community.{" "}
          <Link href="/" className="text-gray-400 underline hover:text-white">Back to home</Link>
        </p>
      </div>
      <div className="mx-auto w-full max-w-md">
        <h1 className="mb-6 text-center text-2xl font-semibold lg:hidden">{title}</h1>
        {children}
      </div>
    </main>
  );
}
