"use client";
// Shared UI. Sort menu built on Radix Dropdown Menu (accessible: keyboard, focus, Escape),
// styled as a glass pill + floating panel with an animated check on the active option.
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import { motion } from "motion/react";
import { ArrowUpDown, Check } from "lucide-react";

export type SortOption<T extends string> = { value: T; label: string; hint?: string };

export function SortMenu<T extends string>({ value, options, onChange }: { value: T; options: SortOption<T>[]; onChange: (v: T) => void }) {
  const current = options.find((o) => o.value === value);
  return (
    <Dropdown.Root>
      <Dropdown.Trigger
        className="inline-flex h-9 items-center gap-2 rounded-full border border-white/80 bg-white/60 px-3.5 text-sm font-medium text-ink shadow-[0_1px_2px_rgba(17,23,20,0.05)] outline-none backdrop-blur transition hover:bg-white data-[state=open]:bg-white"
        aria-label="Trier"
      >
        <ArrowUpDown className="size-3.5 text-muted" aria-hidden />
        {current?.label}
      </Dropdown.Trigger>
      <Dropdown.Portal>
        <Dropdown.Content
          align="end"
          sideOffset={8}
          className="z-[90] min-w-[220px] overflow-hidden rounded-[16px] border border-white/80 bg-white/85 p-1.5 shadow-[0_18px_40px_rgba(17,23,20,0.16)] backdrop-blur-xl data-[state=open]:animate-[menu-in_140ms_ease-out]"
        >
          <Dropdown.Label className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Trier par</Dropdown.Label>
          <Dropdown.RadioGroup value={value} onValueChange={(v) => onChange(v as T)}>
            {options.map((o) => (
              <Dropdown.RadioItem
                key={o.value}
                value={o.value}
                className="relative flex cursor-pointer select-none items-center gap-3 rounded-[10px] py-2 pl-2.5 pr-8 text-sm outline-none transition data-[highlighted]:bg-sunken data-[state=checked]:font-semibold"
              >
                <span className="flex flex-col">
                  {o.label}
                  {o.hint && <span className="text-xs font-normal text-muted">{o.hint}</span>}
                </span>
                <Dropdown.ItemIndicator className="absolute right-2.5">
                  <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="grid size-5 place-items-center rounded-full bg-brand text-on-brand">
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                  </motion.span>
                </Dropdown.ItemIndicator>
              </Dropdown.RadioItem>
            ))}
          </Dropdown.RadioGroup>
        </Dropdown.Content>
      </Dropdown.Portal>
    </Dropdown.Root>
  );
}
