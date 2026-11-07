"use client";
// OWNER: Dev 1. Photo du ticket → réduite dans le navigateur → POST /api/receipts → page du ticket.
// Vercel refuse les envois > 4,5 Mo : on réduit la photo ici (le serveur la redresse et la réduit encore).
import { useState } from "react";
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

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setPreview(URL.createObjectURL(file));
    setPending(true);
    try {
      const image = await downscale(file);
      if (image.size > MAX_BYTES) throw new Error("Photo trop lourde. Réessayez avec une photo plus petite.");
      const form = new FormData();
      form.append("image", image, "ticket.jpg");
      const res = await fetch("/api/receipts", { method: "POST", body: form });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error?.message ?? "Envoi impossible. Réessayez.");
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
        <img src={preview} alt="Aperçu du ticket" className="max-h-72 w-full rounded-xl border border-neutral-500/30 object-contain" />
      )}

      {pending ? (
        <div className="flex flex-col items-center gap-2 rounded-xl bg-neutral-500/10 p-6 text-center">
          <div className="size-6 animate-spin rounded-full border-2 border-neutral-500/40 border-t-foreground" />
          <p className="font-medium">Lecture du ticket…</p>
          <p className="text-sm text-neutral-500">Ça prend 10 à 30 secondes.</p>
        </div>
      ) : (
        <>
          <label className="cursor-pointer rounded-xl bg-foreground px-4 py-5 text-center text-lg font-medium text-background">
            Prendre une photo
            <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <label className="cursor-pointer rounded-xl border border-neutral-500/40 px-4 py-3 text-center font-medium">
            Choisir une photo existante
            <input type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          </label>
          <p className="text-sm text-neutral-500">Ticket bien à plat, en entier, sans reflet. Le total doit être visible.</p>
        </>
      )}

      {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    </div>
  );
}
