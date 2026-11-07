"use client";
// Shared UI. One button for the whole app: variants, sizes, press animation, loading state.
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { LoaderCircle } from "lucide-react";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger" | "danger-soft";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:brightness-[0.96] shadow-[0_1px_2px_rgba(21,128,61,0.25)]",
  dark: "bg-ink text-surface hover:bg-ink/90",
  secondary: "border border-line bg-raised text-ink hover:border-line-strong/60 hover:bg-sunken/40",
  ghost: "text-muted hover:bg-sunken hover:text-ink",
  danger: "bg-danger text-white hover:brightness-95",
  "danger-soft": "border border-line bg-raised text-on-danger-soft hover:bg-danger-soft",
};
const SIZE: Record<Size, string> = {
  sm: "h-9 px-3.5 text-sm rounded-[10px] gap-1.5",
  md: "h-11 px-4 text-[15px] rounded-[12px] gap-2",
  lg: "h-[52px] px-5 text-base rounded-[14px] gap-2",
};

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "onAnimationStart" | "onDrag" | "onDragStart" | "onDragEnd"> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: ReactNode;
  block?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "dark", size = "md", loading = false, icon, block, className = "", children, disabled, ...props },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileTap={disabled || loading ? undefined : { scale: 0.97 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={`relative inline-flex select-none items-center justify-center font-semibold transition-colors disabled:opacity-50 ${VARIANT[variant]} ${SIZE[size]} ${block ? "w-full" : ""} ${className}`}
      {...props}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {loading ? (
          <motion.span key="spin" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="inline-flex">
            <LoaderCircle className="size-[1.1em] animate-spin" aria-hidden />
          </motion.span>
        ) : (
          icon && (
            <motion.span key="icon" initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.6 }} className="inline-flex">
              {icon}
            </motion.span>
          )
        )}
      </AnimatePresence>
      <span className="inline-flex items-center gap-[inherit]">{children}</span>
    </motion.button>
  );
});
