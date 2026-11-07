"use client";
// OWNER: Dev 1. Photo du ticket → réduite dans le navigateur → POST /api/receipts → page du ticket.
// Vercel refuse les envois > 4,5 Mo : on réduit la photo ici (le serveur la redresse et la réduit encore).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ImagePlus, Maximize2, X } from "lucide-react";
import { createPortal } from "react-dom";
import { ReceiptScan } from "@/components/ui/receipt-scan";
import { useDemoRaw } from "@/components/demo/demo-state";
import { DEMO_TICKET } from "@/lib/demo/config";

const PIXEL_BUDGET = 2000 * 1500; // un peu plus que le serveur (1600×1200) : il fait la réduction finale
const MAX_BYTES = 4.5 * 1024 * 1024;

async function downscale(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, Math.sqrt(PIXEL_BUDGET / (bitmap.width * bitmap.height)));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob"))), "image/jpeg", 0.9),
    );
  } catch {
    return file; // format que le navigateur ne sait pas lire (ex. HEIC hors Safari) : le serveur s'en charge
  }
}

export function UploadForm() {
  // Jury demo mode (components/demo): offers the fictional receipt in one tap.
  const demo = useDemoRaw() !== null;
  const [zoom, setZoom] = useState(false);
  async function pickDemoTicket() {
    setZoom(false);
    const blob = await fetch(DEMO_TICKET).then((r) => r.blob());
    void onFile(new File([blob], "ticket-demo.png", { type: blob.type || "image/png" }));
  }
  const router = useRouter();
  const [preview, setPreview] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanLimit, setScanLimit] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setScanLimit(false);
    setPreview(URL.createObjectURL(file));
    setPending(true);
    try {
      const image = await downscale(file);
      if (image.size > MAX_BYTES) throw new Error("Photo trop lourde. Réessayez avec une photo plus petite.");
      const form = new FormData();
      form.append("image", image, "ticket.jpg");
      const res = await fetch("/api/receipts", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
      setScanLimit(res.status === 402 || body?.error?.code === "scan_limit_reached");
      throw new Error(body?.error?.message ?? "Envoi impossible. Réessayez.");
    }
      if (body.status !== "parsed") throw new Error("Le ticket n'a pas pu être lu. Reprenez la photo bien à plat, sans reflet, en entier.");
      router.push(`/receipts/${body.receiptId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur inattendue.");
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative">
        <ReceiptScan scanning={pending} size={pending ? 240 : 220} />
        {pending && preview && (
          // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), pas d'optimisation utile
          <img src={preview} alt="Ta photo" className="absolute -right-6 bottom-2 h-24 w-16 rotate-6 rounded-[10px] border-2 border-raised object-cover shadow-lg" />
        )}
      </div>

      <AnimatePresence mode="wait">
        {pending ? (
          <motion.div key="reading" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex flex-col items-center gap-1.5 text-center">
            <p className="text-lg font-semibold">Lecture du ticket…</p>
            <p className="text-sm text-muted">On recopie chaque ligne et on vérifie les montants. 10 à 30 secondes.</p>
          </motion.div>
        ) : (
          <motion.div key="actions" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="flex w-full max-w-sm flex-col gap-2.5">
            {demo && (
              <div
                id="demo-ticket"
                data-zoom-open={zoom ? "" : undefined}
                className="mb-2 flex flex-col gap-3 rounded-[20px] bg-white/85 p-3 shadow-[0_12px_32px_-18px_rgba(17,23,20,0.3)] ring-1 ring-black/[0.06]"
              >
                <div className="flex items-center gap-3.5">
                  <button type="button" onClick={() => setZoom(true)} aria-label="Voir le ticket de démo en grand" className="group relative shrink-0 overflow-hidden rounded-[6px] ring-1 ring-black/10">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static demo image */}
                    <img src={DEMO_TICKET} alt="" className="h-20 w-12 object-cover object-top transition group-hover:scale-105" />
                  </button>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold">Ticket de démo</span>
                    <span className="block text-[13px] text-muted">Carrefour Bastille · ticket fictif avec NotCoca</span>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    data-demo-zoom
                    onClick={() => setZoom(true)}
                    className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-white text-[14px] font-semibold text-ink ring-1 ring-black/[0.1] transition hover:bg-black/[0.03] active:scale-[0.98]"
                  >
                    <Maximize2 className="size-4" aria-hidden /> Voir le ticket
                  </button>
                  <button
                    type="button"
                    data-demo-use
                    onClick={pickDemoTicket}
                    className="inline-flex h-10 items-center justify-center rounded-full bg-ink text-[14px] font-semibold text-surface transition hover:bg-ink/90 active:scale-[0.98]"
                  >
                    Utiliser ce ticket
                  </button>
                </div>
              </div>
            )}
            <label className="inline-flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full bg-ink px-5 text-[15px] font-semibold text-surface transition hover:bg-ink/90 active:scale-[0.98]">
              <Camera className="size-5" aria-hidden />
              Prendre une photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <label className="inline-flex h-[52px] cursor-pointer items-center justify-center gap-2 rounded-full bg-white/80 px-5 text-[15px] font-semibold text-ink ring-1 ring-black/[0.06] transition hover:bg-white active:scale-[0.98]">
              <ImagePlus className="size-5 text-muted" aria-hidden />
              Choisir une photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <p className="mt-1 text-center text-xs text-muted">Bien à plat, en entier, sans reflet. Le total doit être visible.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-[18px] bg-danger-soft px-5 py-3.5 text-center text-sm text-on-danger-soft">
          {error}
          {scanLimit && (
            <>
              <br />
              <Link href="/billing" className="font-semibold underline">Passer à Refundit+</Link>
            </>
          )}
        </motion.div>
      )}
      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {zoom && (
              <motion.div
                key="zoom"
                className="fixed inset-0 flex items-center justify-center bg-[#0b0f0d]/70 p-4 backdrop-blur-[3px]"
                style={{ zIndex: 1000000001 }} // above the demo tour's spotlight and popover
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setZoom(false)}
                role="dialog"
                aria-modal="true"
                aria-label="Ticket de démo"
              >
                <motion.div
                  initial={{ scale: 0.9, y: 20 }}
                  animate={{ scale: 1, y: 0 }}
                  exit={{ scale: 0.95, y: 10 }}
                  transition={{ type: "spring", stiffness: 320, damping: 28 }}
                  onClick={(e) => e.stopPropagation()}
                  className="flex max-h-full w-full max-w-[420px] flex-col overflow-hidden rounded-[24px] bg-surface shadow-2xl"
                >
                  <div className="flex items-center justify-between px-5 py-3">
                    <p className="text-[15px] font-semibold">Ticket de démo</p>
                    <button type="button" onClick={() => setZoom(false)} aria-label="Fermer" className="grid size-8 place-items-center rounded-full bg-black/[0.05] text-muted hover:text-ink">
                      <X className="size-4" aria-hidden />
                    </button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4">
                    {/* eslint-disable-next-line @next/next/no-img-element -- static demo image */}
                    <img src={DEMO_TICKET} alt="Ticket de caisse fictif Carrefour Bastille : Nutella, Prince, Panzani, Evian, NotCoca 6×33 cl, NotCoca Zéro, Dove" className="mx-auto w-full max-w-[360px]" />
                  </div>
                  {/* No "use" here on purpose: close the zoom first, then "Utiliser ce ticket" (the demo tour's next step). */}
                  <div className="p-4">
                    <button type="button" onClick={() => setZoom(false)} className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-surface">
                      Fermer
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}
