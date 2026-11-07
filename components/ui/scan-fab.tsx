"use client";
// Shared UI. Floating "Scanner" button, bottom right on every screen (except the scan screen).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanLine } from "lucide-react";

export function ScanFab() {
  const path = usePathname();
  if (path.startsWith("/receipts/new") || path.startsWith("/onboarding")) return null;
  return (
    <Link
      href="/receipts/new"
      aria-label="Scanner un ticket de caisse"
      className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-40 inline-flex items-center gap-2 rounded-full bg-brand py-3.5 pl-4 pr-5 text-[15px] font-semibold text-on-brand shadow-[0_8px_24px_rgba(21,128,61,0.28)] transition hover:-translate-y-0.5 active:scale-95 md:bottom-8 md:right-8"
    >
      <ScanLine className="size-5" strokeWidth={2.2} aria-hidden />
      Scanner
    </Link>
  );
}
