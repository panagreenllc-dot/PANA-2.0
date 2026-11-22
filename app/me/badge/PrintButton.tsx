"use client";
export default function PrintButton() {
  return <button type="button" onClick={() => window.print()} className="rounded-xl border border-white/20 px-5 py-2 text-sm font-semibold hover:bg-white/10 print:hidden">Print</button>;
}
