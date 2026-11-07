// Secours web PAYANT quand Open Food Facts ne trouve rien de bon : Linkup cherche le vrai nom du produit
// (ex. « MADELEINE TRADITIO » → « Bonne Maman Madeleines Tradition » sur monoprix.fr), puis on relance
// Open Food Facts avec ce nom pour avoir l'EAN et la photo.
// - Activé seulement si LINKUP_PRODUCTS=true (et LINKUP_API_KEY).
// - UN appel par article, JAMAIS relancé (CLAUDE.md règle 9 ; 429 = crédit épuisé). Réponse mise en cache,
//   échecs compris : un même libellé n'est jamais payé deux fois.
// API vérifiée le 2026-11-07 (docs.linkup.so : POST /v1/search, depth fast|standard|deep, outputType "structured",
// structuredOutputSchema en chaîne JSON, includeSources → { data, sources }). Prix : 0,005-0,006 $ par appel (linkup.so/pricing).
import "server-only";
import { z } from "zod";
import { cached } from "./net";
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

export async function webProducts(rawLabel: string, chain: string | null, unitPriceCents: number | null): Promise<WebProduct[]> {
  const price = unitPriceCents ? ` coûte ${(unitPriceCents / 100).toFixed(2).replace(".", ",")} € et` : "";
  const where = chain ? `chez ${chain}` : "en supermarché";
  const q =
    `Sur un ticket de caisse ${chain ?? "de supermarché"} (France), la ligne « ${rawLabel} »${price} désigne un produit. ` +
    `Les libellés de ticket sont abrégés et tronqués vers 18 caractères. Quels produits vendus ${where} peuvent correspondre ? ` +
    `Pour chacun : marque, nom complet, format, et code EAN seulement s'il est écrit dans une source.`;

  return cached(`linkup:${q}`, async () => {
    try {
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
    } catch (err) {
      console.error("[linkup]", rawLabel, err); // jamais relancé : on garde « rien trouvé » en cache
      return [];
    }
  });
}
