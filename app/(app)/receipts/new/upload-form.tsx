"use client";
// OWNER: Dev 1. Photo du ticket → réduite dans le navigateur → POST /api/receipts → page du ticket.
// Vercel refuse les envois > 4,5 Mo : on réduit la photo ici (le serveur la redresse et la réduit encore).
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

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
    <div className="flex flex-col gap-4">
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element -- aperçu local (blob:), pas d'optimisation utile
        <img src={preview} alt="Aperçu du ticket" className="max-h-72 w-full rounded-[20px] border border-line-strong/50 object-contain" />
      )}

      {pending ? (
        <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-[24px] bg-[#111714] p-8 text-center text-[#F2F4F1]">
          {/* scanline */}
          <div className="pointer-events-none absolute inset-x-6 top-0 h-0.5 animate-[scan_1.6s_ease-in-out_infinite] bg-[#4ADE80] shadow-[0_0_18px_#4ADE80]" aria-hidden />
          <p className="text-lg font-bold">Lecture du ticket…</p>
          <p className="text-sm text-[#A4ADA7]">On recopie chaque ligne et on vérifie les montants. 10 à 30 secondes.</p>
        </div>
      ) : (
        <>
          <label className="group relative grid cursor-pointer place-items-center gap-3 rounded-[24px] border-2 border-dashed border-line-strong/60 bg-sunken px-6 py-10 text-center transition hover:border-ink">
            <span className="grid size-16 place-items-center rounded-full bg-ink text-surface transition group-hover:scale-105" aria-hidden>
              <svg viewBox="0 0 24 24" className="size-7" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" /><circle cx="12" cy="12" r="3.5" />
              </svg>
            </span>
            <span className="text-lg font-bold">Prendre le ticket en photo</span>
            <span className="text-sm text-muted">Bien à plat, en entier, sans reflet</span>
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <label className="cursor-pointer rounded-[14px] border border-line-strong/60 bg-raised px-4 py-3 text-center text-sm font-semibold transition hover:border-ink">
            Choisir une photo existante
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
        </>
      )}

      {error && (
        <div className="rounded-[20px] bg-danger-soft p-3 text-sm text-on-danger-soft">
          {error}
          {scanLimit && (
            <>
              <br />
              <Link href="/billing" className="font-medium underline">Passez à Refundit Illimité</Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
