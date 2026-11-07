Shared UI components (owner: Dev 1). Dev 2 may add components; don't change existing props without a heads-up.

| File | What |
|---|---|
| `brand.tsx` | `Logo`, `Money`, `formatEuros`, `StripeBadge`, `Card` |
| `button.tsx` | `Button` (motion press; variants primary/dark/secondary/ghost/danger/danger-soft; `loading`, `icon`) |
| `motion.tsx` | `FadeIn`, `StaggerItem`, `AnimatedMoney` (NumberFlow), `Toaster` (sonner) |
| `aurora.tsx` | `Aurora` animated background (fixed, `-z-10`), `glass` card class |
| `status.tsx` | claim status labels, groups, `StatusBadge` |
| `format.ts` | `displayLabel`, `shortDate`, `dateTime` |
| `account-menu.tsx` | top-right account dropdown (plan, profile, billing, sign out) |
| `sort-menu.tsx` | `SortMenu` (Radix dropdown radio) |
| `scan-fab.tsx` | floating "Scanner" button (hidden on `/receipts/new`, `/onboarding`) |
| `receipt-scan.tsx` | animated receipt illustration |
| `field.tsx` | form field |

Overlays (lightbox, modals) must be portaled to `document.body`.
