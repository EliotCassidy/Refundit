// Shared UI. Store logo from the static registry (lib/stores.ts).
// `StoreIcon`: square avatar (logo on white, or brand-colored monogram). `StoreBanner`: full logo for headers.
import { ReceiptText } from "lucide-react";
import { storeAsset, type Store } from "@/lib/stores";

export function StoreIcon({ store, fallbackName, size = 44, className = "" }: { store: Store | null; fallbackName?: string | null; size?: number; className?: string }) {
  const box = `grid shrink-0 place-items-center overflow-hidden rounded-[14px] ring-1 ring-black/[0.06] ${className}`;
  if (store?.icon) {
    return (
      <span className={`${box} bg-white`} style={{ width: size, height: size }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- tiny static logos, no optimizer needed */}
        <img src={storeAsset(store.icon)} alt="" className="size-[78%] object-contain" />
      </span>
    );
  }
  const label = store?.name ?? fallbackName;
  if (!label) {
    return (
      <span className={`${box} bg-sunken text-muted`} style={{ width: size, height: size }}>
        <ReceiptText className="size-[45%]" aria-hidden />
      </span>
    );
  }
  return (
    <span className={`${box} font-bold text-white`} style={{ width: size, height: size, background: store?.color ?? "#111714", fontSize: size * 0.42 }}>
      {label.replace(/^[^A-Za-zÀ-ÿ0-9]+/, "").charAt(0).toUpperCase()}
    </span>
  );
}

export function StoreBanner({ store, fallbackName }: { store: Store | null; fallbackName?: string | null }) {
  if (store?.wordmark) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- static logo
      <img src={storeAsset(store.wordmark)} alt={store.name} className="h-11 w-auto max-w-[200px] object-contain" />
    );
  }
  return <StoreIcon store={store} fallbackName={fallbackName} size={64} className="rounded-[18px] shadow-[0_8px_20px_-8px_rgba(17,23,20,0.25)]" />;
}
