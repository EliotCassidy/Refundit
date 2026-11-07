"use client";
// OWNER: Dev 1. Photo du ticket → réduite dans le navigateur → POST /api/receipts → page du ticket.
// Vercel refuse les envois > 4,5 Mo : on réduit la photo ici (le serveur la redresse et la réduit encore).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { Camera, ImagePlus } from "lucide-react";
import { ReceiptScan } from "@/components/ui/receipt-scan";

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
            <label className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] bg-ink px-5 font-semibold text-surface transition hover:bg-ink/90 active:scale-[0.98]">
              <Camera className="size-5" aria-hidden />
              Prendre une photo
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <label className="inline-flex h-[52px] items-center justify-center gap-2 rounded-[14px] border border-line bg-raised px-5 font-semibold text-ink transition hover:bg-sunken/50 active:scale-[0.98]">
              <ImagePlus className="size-5 text-muted" aria-hidden />
              Choisir une photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
            </label>
            <p className="mt-1 text-center text-xs text-muted">Bien à plat, en entier, sans reflet. Le total doit être visible.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {error && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm rounded-[14px] bg-danger-soft p-3 text-center text-sm text-on-danger-soft">
          {error}
          {scanLimit && (
            <>
              <br />
              <Link href="/billing" className="font-semibold underline">Passer à Refundit Illimité</Link>
            </>
          )}
        </motion.div>
      )}
    </div>
  );
}
