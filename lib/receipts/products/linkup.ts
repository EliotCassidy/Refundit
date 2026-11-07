// Secours web PAYANT quand Open Food Facts ne trouve rien de bon : Linkup cherche le vrai nom du produit
// (ex. « MADELEINE TRADITIO » → « Bonne Maman Madeleines Tradition » sur monoprix.fr), puis on relance
// Open Food Facts avec ce nom pour avoir l'EAN et la photo.
// - Activé seulement si LINKUP_PRODUCTS=true (et LINKUP_API_KEY).
// - UN appel par article, JAMAIS relancé dans la même requête (CLAUDE.md règle 9 ; 429 = crédit épuisé).
//   Seules les vraies réponses sont mises en cache (une réponse vide expire en 24 h) : un échec n'est pas figé.
// API vérifiée le 2026-11-07 (docs.linkup.so : POST /v1/search, depth fast|standard|deep, outputType "structured",
// structuredOutputSchema en chaîne JSON, includeSources → { data, sources }). Prix : 0,005-0,006 $ par appel (linkup.so/pricing).
import "server-only";
import { z } from "zod";
import { cached, readCached } from "./net";
import { isValidEan } from "./ean";

const LINKUP_URL = "https://api.linkup.so/v1/search";

const SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          brand: { type: ["string", "null"] },
          name: { type: "string", description: "nom complet du produit, tel qu'écrit sur l'emballage ou le site" },
          quantity: { type: ["string", "null"], description: "format, ex. 250 g" },
          ean: { type: ["string", "null"], description: "code-barres EAN seulement s'il est écrit dans une source" },
        },
        required: ["name"],
      },
    },
  },
  required: ["products"],
};

const ResponseSchema = z.object({
  data: z.object({
    products: z
      .array(z.object({ brand: z.string().nullish(), name: z.string(), quantity: z.string().nullish(), ean: z.string().nullish() }))
      .default([]),
  }),
  sources: z.array(z.object({ url: z.string(), content: z.string().optional(), snippet: z.string().optional() })).default([]),
});

export type WebProduct = { brand: string | null; name: string; quantity: string | null; ean: string | null };

export const linkupEnabled = () => process.env.LINKUP_PRODUCTS === "true" && Boolean(process.env.LINKUP_API_KEY);
// Photo de secours : interrupteur séparé (actif dès qu'une clé existe ; LINKUP_IMAGES=false pour couper).
export const linkupImagesEnabled = () => process.env.LINKUP_IMAGES !== "false" && Boolean(process.env.LINKUP_API_KEY);

export async function webProducts(rawLabel: string, chain: string | null, unitPriceCents: number | null): Promise<WebProduct[]> {
  const price = unitPriceCents ? ` coûte ${(unitPriceCents / 100).toFixed(2).replace(".", ",")} € et` : "";
  const where = chain ? `chez ${chain}` : "en supermarché";
  const q =
    `Sur un ticket de caisse ${chain ?? "de supermarché"} (France), la ligne « ${rawLabel} »${price} désigne un produit. ` +
    `Les libellés de ticket sont abrégés et tronqués vers 18 caractères. Quels produits vendus ${where} peuvent correspondre ? ` +
    `Pour chacun : marque, nom complet, format, et code EAN seulement s'il est écrit dans une source.`;

  // Évals : LINKUP_CACHE_ONLY=true relit seulement les réponses déjà payées (aucun appel), pour itérer gratuitement.
  if (process.env.LINKUP_CACHE_ONLY === "true") return (await readCached<WebProduct[]>(`linkup:${q}`)) ?? [];

  try {
    return await cached(`linkup:${q}`, async () => {
      const res = await fetch(LINKUP_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.LINKUP_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          q,
          depth: "standard",
          outputType: "structured",
          structuredOutputSchema: JSON.stringify(SCHEMA),
          includeSources: true,
          excludeDomains: ["prices.openfoodfacts.org"], // pas les preuves Open Prices (on évalue dessus)
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Linkup ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const r = ResponseSchema.parse(await res.json());
      // Contre les inventions : un EAN n'est gardé que s'il est écrit tel quel dans une source et que sa clé est valide.
      const corpus = r.sources.map((s) => `${s.url} ${s.content ?? ""} ${s.snippet ?? ""}`).join("\n");
      return r.data.products.slice(0, 5).map((p) => {
        const ean = p.ean?.replace(/\D/g, "") ?? "";
        return {
          brand: p.brand?.trim() || null,
          name: p.name.trim(),
          quantity: p.quantity?.trim() || null,
          ean: isValidEan(ean) && corpus.includes(ean) ? ean : null,
        };
      });
    });
  } catch (err) {
    console.error("[linkup]", rawLabel, err); // pas de réessai ici, et rien en cache : un échec n'est pas figé
    return [];
  }
}

// Photo de secours (PAYANT) quand aucune base Open Facts n'a de photo pour ce produit (ex. EAN trouvé sur le web).
// Docs vérifiées le 2026-11-07 (docs.linkup.so, POST /v1/search) : includeImages (booléen, défaut false) ;
// outputType "searchResults" → { results: [ { type: "text", name, url, content } | { type: "image", name, url } ] } ;
// maxResults (≤). Prix : 0,005 $ par appel en depth standard / searchResults (la doc ne dit pas que les images changent le prix).
// UN appel par produit (clé = EAN), mis en cache, jamais relancé (règle 9). null si rien de sûr.
const ImageResults = z.object({
  results: z.array(z.object({ type: z.string(), name: z.string().nullish(), url: z.string() })).default([]),
});

const words = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 3);

export async function webImage(p: { ean: string; name: string; brand: string | null; quantity: string | null }): Promise<string | null> {
  const label = [p.brand, p.name, p.quantity].filter(Boolean).join(" ");
  const key = `linkup-image:${p.ean}`;
  if (process.env.LINKUP_CACHE_ONLY === "true") return (await readCached<string | null>(key)) ?? null;
  try {
    return await cached(key, async () => {
      const res = await fetch(LINKUP_URL, {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.LINKUP_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          q: `Photo du produit « ${label} » (code-barres ${p.ean}), emballage de face, vendu en supermarché en France`,
          depth: "standard",
          outputType: "searchResults",
          includeImages: true,
          maxResults: 10,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`Linkup ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const images = ImageResults.parse(await res.json()).results.filter((r) => r.type === "image" && r.url.startsWith("https://"));
      // Contre les photos d'un autre produit : l'image doit nommer la marque (ou, sans marque, un mot du nom).
      const must = words(p.brand ?? p.name).slice(0, 2);
      const match = images.find((i) => {
        const text = words(`${i.name ?? ""} ${decodeURIComponent(i.url)}`).join(" ");
        return must.length > 0 && must.some((w) => text.includes(w));
      });
      return match?.url ?? null;
    });
  } catch (err) {
    console.error("[linkup image]", label, err); // pas de réessai, rien en cache
    return null;
  }
}
