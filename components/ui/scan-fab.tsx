"use client";
// Shared UI. Floating "Scanner" button, bottom right on every app screen (hidden on the scan screen).
import Link from "next/link";
import { usePathname } from "next/navigation";

export function ScanFab() {
  const path = usePathname();
  if (path.startsWith("/receipts/new")) return null;
  return (
    <Link
      href="/receipts/new"
      aria-label="Scanner un ticket de caisse"
      className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand px-5 py-4 font-bold text-on-brand shadow-[0_10px_30px_rgba(17,23,20,0.25)] transition hover:-translate-y-0.5 hover:shadow-[0_14px_34px_rgba(17,23,20,0.3)] active:translate-y-0 md:bottom-8 md:right-8"
    >
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10" />
      </svg>
      Scanner
    </Link>
  );
}
