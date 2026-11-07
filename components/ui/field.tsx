// OWNER: Dev 1. Champ texte partagé (label + input), lisible en thème sombre.
import type { InputHTMLAttributes } from "react";

export function Field({ label, optional, ...props }: { label: string; optional?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium">
        {label}
        {optional && <span className="font-normal text-muted"> (facultatif)</span>}
      </span>
      <input
        {...props}
        className="w-full rounded-[14px] border border-line-strong/50 px-3 py-2 outline-none focus:border-ink"
      />
    </label>
  );
}
