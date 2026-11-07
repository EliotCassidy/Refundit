// Shared UI. The app's one layout language (bank-app "grouped list"): a centered page header,
// sections = small muted title + one white rounded group, rows separated by hairlines.
// Server-safe (no hooks): usable from server and client components.
import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export const group =
  "overflow-hidden rounded-[24px] bg-white/80 shadow-[0_1px_2px_rgba(17,23,20,0.04),0_12px_32px_-18px_rgba(17,23,20,0.18)] ring-1 ring-black/[0.05] backdrop-blur-xl";

export function PageHeader({ title, subtitle, children }: { title: ReactNode; subtitle?: ReactNode; children?: ReactNode }) {
  return (
    <header className="flex flex-col items-center text-center">
      {children}
      <h1 className="text-balance text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1.5 max-w-[440px] text-balance text-[15px] text-muted">{subtitle}</p>}
    </header>
  );
}

export function Section({ title, footer, children, className = "" }: { title?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col gap-2 ${className}`}>
      {title && <h2 className="px-5 text-[13px] font-medium text-muted">{title}</h2>}
      <div className={`${group} divide-y divide-black/[0.05]`}>{children}</div>
      {footer && <p className="px-5 text-[12px] leading-relaxed text-muted">{footer}</p>}
    </section>
  );
}

/** Label left, value right. */
export function Row({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-[52px] items-center justify-between gap-4 px-5 py-3">
      <span className="shrink-0 text-[15px] text-muted">{label}</span>
      <span className="min-w-0 truncate text-right text-[15px] font-medium">{children}</span>
    </div>
  );
}

type NavRowProps = {
  icon?: ReactNode;
  label: ReactNode;
  description?: ReactNode;
  value?: ReactNode;
  tone?: "default" | "danger";
  chevron?: boolean;
};

function NavRowInner({ icon, label, description, value, tone = "default", chevron = true }: NavRowProps) {
  return (
    <>
      {icon && (
        <span className={`grid size-9 shrink-0 place-items-center rounded-full ${tone === "danger" ? "bg-danger-soft text-on-danger-soft" : "bg-sunken text-ink"}`}>{icon}</span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-[15px] font-medium ${tone === "danger" ? "text-on-danger-soft" : ""}`}>{label}</span>
        {description && <span className="block truncate text-[13px] text-muted">{description}</span>}
      </span>
      {value != null && <span className="shrink-0 text-[14px] text-muted">{value}</span>}
      {chevron && <ChevronRight className="size-4 shrink-0 text-muted transition group-hover:translate-x-0.5" aria-hidden />}
    </>
  );
}
const navRow = "group flex w-full min-h-[56px] items-center gap-3.5 px-5 py-3 text-left transition-colors hover:bg-black/[0.02] active:bg-black/[0.04] disabled:opacity-60";

/** Tappable row (link or button) with icon, label, optional value and chevron. */
export function NavRow({ href, ...p }: NavRowProps & { href: string }) {
  return (
    <Link href={href} className={navRow}>
      <NavRowInner {...p} />
    </Link>
  );
}
export function ButtonRow({ onClick, disabled, type = "button", ...p }: NavRowProps & Pick<ComponentProps<"button">, "onClick" | "disabled" | "type">) {
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={navRow}>
      <NavRowInner {...p} />
    </button>
  );
}

/** Editable row: label left, borderless input right (settings style). */
export function InputRow({ label, hint, className = "", ...input }: { label: ReactNode; hint?: string } & ComponentProps<"input">) {
  return (
    <label className="flex min-h-[52px] cursor-text items-center gap-4 px-5 py-1.5 focus-within:bg-black/[0.015]">
      <span className="w-[112px] shrink-0 text-[15px] text-muted">{label}</span>
      <input
        {...input}
        className={`h-10 min-w-0 flex-1 bg-transparent text-right text-[15px] font-medium text-ink outline-none placeholder:font-normal placeholder:text-muted/60 ${className}`}
        placeholder={input.placeholder ?? hint}
      />
    </label>
  );
}
