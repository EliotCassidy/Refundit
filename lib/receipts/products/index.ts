// Étape 2 : un article coché → top 5 des vrais produits (ProductCandidates, API_CONTRACTS §3).
// Un seul article par appel (la page les lance en parallèle) pour tenir dans maxDuration.
// Linkup (payant) n'est pas utilisé ici pour l'instant : à activer seulement avec accord explicite.
import "server-only";
import type { ProductCandidates } from "@/lib/shared/types";
import { normalize, sameWord, tokens } from "../text";
import { expandLabel } from "./expand";
import { findConfirmedMatches } from "./matches";
import { quantityVariants, searchObf, searchOff, type Hit } from "./off";
import { parseSizes } from "./ean";
import { referencePrice } from "./prices";
import { isSizeToken, preScore, privateLabel, rank, type Candidate } from "./rank";

export type IdentifyInput = {
  rawLabel: string;
  section: string | null; // rayon imprimé sur le ticket
  chain: string | null; // enseigne imprimée sur le ticket
  unitPriceCents: number | null; // prix unitaire payé, avant remise
  excludeProofId?: number; // éval : ignorer les prix Open Prices de ce ticket
};

const PRICED = 6; // nombre de candidats dont on cherche le prix de référence
const BEAUTY_SECTION_RE = /PARFUM|HYGIENE|BEAUTE|SOIN|DENTAIRE|COSMET/;

export async function identifyProduct(input: IdentifyInput): Promise<ProductCandidates> {
  const [guess, confirmed] = await Promise.all([
    expandLabel(input.rawLabel, input.chain, input.section),
    findConfirmedMatches(input.chain, input.rawLabel).catch((err) => {
      console.error("[product_matches]", err);
      return [];
    }),
  ]);

  const labelTokens = tokens(input.rawLabel);
  const brandRead =
    guess?.brand && guess.brand_raw && labelTokens.some((t) => sameWord(t, normalize(guess.brand_raw!).split(" ")[0] ?? ""))
      ? guess.brand
      : null;
  const mdd = privateLabel(input.chain);
  const beauty = guess?.category === "beauty_hygiene" || BEAUTY_SECTION_RE.test(normalize(input.section ?? ""));

  // Texte de recherche : les mots du produit développés (une requête, pas un résultat), sans format ni marque
  // (la marque sert de filtre à part). Sans hypothèse : le libellé brut.
  const skip = new Set([...tokens(brandRead ?? ""), ...tokens(mdd ?? ""), "GRAMMES", "GRAMME", "LITRES", "LITRE", "KG", "CL", "ML"]);
  const text =
    tokens(guess?.full_name || input.rawLabel)
      .filter((t) => t.length >= 2 && !isSizeToken(t) && !/^\d/.test(t) && !skip.has(t))
      .join(" ")
      .toLowerCase() || input.rawLabel;

  // Recherches : marque lue sur le ticket, puis marque de l'enseigne, puis texte libre.
  const searches: Promise<Hit[]>[] = [];
  if (beauty) searches.push(searchObf(text));
  if (brandRead) searches.push(searchOff(text, brandRead));
  if (mdd && !brandRead) searches.push(searchOff(text, mdd));
  searches.push(searchOff(text));
  // Et par format, quand le libellé en indique un (total d'un lot, pas la taille d'une unité)
  const size = parseSizes(input.rawLabel).find((s) => !s.per && s.unit !== "u");
  if (size) searches.push(searchOff(text, brandRead ?? mdd, quantityVariants(size)));
  const results = await Promise.all(searches.map((p) => p.catch((err) => (console.error("[search]", err), [] as Hit[]))));

  // Fusion par EAN : les produits déjà confirmés pour ce libellé passent devant.
  const byEan = new Map<string, Candidate>();
  for (const m of confirmed) byEan.set(m.product.ean, { ...m.product, source: "confirmed_match", confirmations: m.confirmations });
  for (const hit of results.flat()) if (!byEan.has(hit.ean)) byEan.set(hit.ean, hit);

  // Prix de référence pour les meilleurs candidats seulement (limite les appels Open Prices).
  const rankInput = { rawLabel: input.rawLabel, guess, chain: input.chain, unitPriceCents: input.unitPriceCents };
  const shortlist = [...byEan.values()].sort((a, b) => preScore(b, rankInput) - preScore(a, rankInput)).slice(0, PRICED);
  for (const c of shortlist) {
    c.reference = await referencePrice(c.ean, input.chain, input.excludeProofId).catch(() => null);
  }

  return { ...rank(shortlist, rankInput), searched_at: new Date().toISOString() };
}
