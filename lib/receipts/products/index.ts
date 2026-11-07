// Étape 2 : un article coché → top 5 des vrais produits (ProductCandidates, API_CONTRACTS §3).
// Un seul article par appel (la page les lance en parallèle) pour tenir dans maxDuration.
// Requêtes et barème inspirés du prototype Python (~/Documents/hackaton/resolve.py), sans Linkup (payant).
import "server-only";
import type { ProductCandidates } from "@/lib/shared/types";
import { labelSimilarity, normalize } from "../text";
import { expandLabel } from "./expand";
import { findConfirmedMatches } from "./matches";
import { offDocument, quantityVariants, searchObf, searchOff, withImage, type Hit } from "./off";
import { linkupEnabled, webProducts } from "./linkup";
import { parseSizes } from "./ean";
import { referencePrice, samePriceAtChain } from "./prices";
import { labelWords, preScore, privateLabel, rank, wordHit, type Candidate } from "./rank";
import { tokens } from "../text";

export type IdentifyInput = {
  rawLabel: string;
  section: string | null; // rayon imprimé sur le ticket
  chain: string | null; // enseigne imprimée sur le ticket
  unitPriceCents: number | null; // prix unitaire payé, avant remise
  excludeProofId?: number; // éval : ignorer les prix Open Prices de ce ticket
  userQuery?: string; // nom du produit tapé par l'utilisateur quand la première recherche n'a rien donné
  full?: boolean; // recherche complète même si le produit est déjà connu (« Chercher d'autres produits »)
};

const LINKUP_BELOW = 70; // secours Linkup si le meilleur score est sous ce seuil (ou aucun candidat)
const PRICED = 20; // nombre de candidats dont on cherche le prix de référence (Open Prices, ~0,2 s chacun)
const BEAUTY_SECTION_RE = /PARFUM|HYGIENE|BEAUTE|SOIN|DENTAIRE|COSMET/;

/** Texte de requête propre : minuscules, sans formats ni nombres. */
const clean = (s: string | null | undefined) =>
  normalize(s ?? "").split(" ").filter((w) => w.length >= 2 && !/\d/.test(w)).join(" ").toLowerCase();

const eanKey = (ean: string) => ean.replace(/^0+/, "");

/** debug (évals) : rempli avec les EAN trouvés par les recherches (pool) et ceux qui ont reçu un prix (shortlist). */
export async function identifyProduct(input: IdentifyInput, debug?: { pool?: string[]; shortlist?: string[] }): Promise<ProductCandidates> {
  // Produits déjà confirmés À LA MAIN par des clients pour ce libellé chez cette enseigne (requête rapide en base).
  const confirmed = await findConfirmedMatches(input.chain, input.rawLabel).catch((err) => {
    console.error("[product_matches]", err);
    return [];
  });

  // Raccourci « déjà connu » : réponse immédiate avec la photo, sans LLM ni Open Food Facts ni Open Prices.
  if (confirmed.length && !input.full && !input.userQuery) {
    const candidates = confirmed.slice(0, 3).map((m) => ({
        ...m.product,
        source: "confirmed_match" as const,
        score: 100,
        reference_price_cents: null,
        reasons: [`confirmé ${m.confirmations} fois par des clients pour ce libellé chez cette enseigne`],
      }));
    candidates[0] = await withImage(candidates[0]); // la carte affiche la photo du 1er
    return {
      llm_guess: null,
      candidates,
      uncertain: false,
      uncertain_reasons: [],
      confident: true,
      searched_at: new Date().toISOString(),
    };
  }

  // Avec un nom tapé par l'utilisateur, pas besoin de faire deviner le libellé au LLM.
  const guess = input.userQuery ? null : await expandLabel(input.rawLabel, input.chain, input.section, input.unitPriceCents);

  const type = guess?.product_type ?? null;
  const variant = guess?.variant ?? null;
  const mdd = privateLabel(input.chain);
  const brands = [...new Set([guess?.brand, mdd].filter((b): b is string => Boolean(b)))];
  const beauty = guess?.category === "beauty_hygiene" || BEAUTY_SECTION_RE.test(normalize(input.section ?? ""));

  // Requêtes (texte, filtre marque) : dans la marque lue puis celle de l'enseigne, puis en texte libre.
  const pairs: [string, string | null][] = [];
  for (const b of brands) pairs.push([`${type ?? ""} ${variant ?? ""}`, b], [variant ?? "", b], [type ?? "", b]);
  pairs.push(
    [`${guess?.brand ?? ""} ${type ?? ""} ${variant ?? ""}`, null],
    [labelWords(input.rawLabel).join(" "), null],
    [variant ?? "", null],
  );
  if (input.userQuery) for (const b of [...brands, null]) pairs.unshift([input.userQuery, b]);
  const queries: [string, string | null][] = [];
  for (const [q, b] of pairs) {
    const text = clean(q);
    if (text && !queries.some(([t, bb]) => t === text && bb === b)) queries.push([text, b]);
  }

  const searches: Promise<Hit[]>[] = queries.map(([q, b]) => searchOff(q, b));
  // Et par format, quand le libellé en indique un (total d'un lot, pas la taille d'une unité)
  const size = parseSizes(input.rawLabel).find((s) => !s.per && s.unit !== "u");
  if (size) searches.push(searchOff(clean(type) || clean(guess?.full_name) || clean(input.rawLabel), brands[0] ?? null, quantityVariants(size)));
  // Hygiène / beauté : Open Beauty Facts (6 s entre deux recherches : seulement les 2 premières requêtes)
  if (beauty) for (const [q] of queries.slice(0, 2)) searches.push(searchObf(q));

  // Et les produits relevés au même prix dans la même enseigne (Open Prices), s'ils partagent un mot avec le libellé.
  const words = labelWords(input.rawLabel);
  searches.push(
    samePriceAtChain(input.chain, input.unitPriceCents, input.excludeProofId).then((ps) =>
      ps.filter((p) => words.some((w) => wordHit(w, tokens(`${p.brand ?? ""} ${p.name}`)))).map(({ seen, ...p }) => ({ ...p, source: "off" as const, seen })),
    ),
  );

  const results = await Promise.all(searches.map((p) => p.catch((err) => (console.error("[search]", err), [] as Hit[]))));

  // Fusion par EAN (sans zéros de tête) : les produits déjà confirmés pour ce libellé passent devant.
  const byEan = new Map<string, Candidate>();
  for (const m of confirmed) byEan.set(eanKey(m.product.ean), { ...m.product, source: "confirmed_match", confirmations: m.confirmations });
  for (const hit of results.flat()) {
    const known = byEan.get(eanKey(hit.ean));
    // Relevé au même prix dans l'enseigne : c'est déjà un prix de référence, sans appel de plus.
    const seen = "seen" in hit ? (hit.seen as number) : 0;
    const reference = seen && input.unitPriceCents ? { cents: input.unitPriceCents, scope: "chain" as const, n: seen } : undefined;
    if (!known) byEan.set(eanKey(hit.ean), { ...hit, reference });
    else if (reference && !known.reference) known.reference = reference;
  }

  // Prix de référence pour les meilleurs candidats seulement (limite les appels Open Prices).
  // Le texte de l'utilisateur est la meilleure preuve quand il existe ; sinon le libellé du ticket.
  const rankInput = { rawLabel: input.userQuery ?? input.rawLabel, guess, chain: input.chain, unitPriceCents: input.unitPriceCents };
  const shortlist = [...byEan.values()].sort((a, b) => preScore(b, rankInput) - preScore(a, rankInput)).slice(0, PRICED);
  if (debug) {
    debug.pool = [...byEan.keys()];
    debug.shortlist = shortlist.map((c) => eanKey(c.ean));
  }
  await Promise.all(
    shortlist.map(async (c) => {
      if (c.reference === undefined) c.reference = await referencePrice(c.ean, input.chain, input.excludeProofId).catch(() => null);
    }),
  );

  let ranked = rank(shortlist, rankInput);

  // Secours web (Linkup, payant) : seulement si Open Food Facts n'a rien trouvé de bon. Un appel, jamais relancé.
  if (linkupEnabled() && (!ranked.candidates.length || ranked.candidates[0].score < LINKUP_BELOW)) {
    const extra: Candidate[] = [];
    for (const w of await webProducts(input.rawLabel, input.chain, input.unitPriceCents)) {
      // EAN lu dans une source → sa fiche ; sinon on relance Open Food Facts avec le vrai nom trouvé sur le web
      const hits = w.ean
        ? [await offDocument(w.ean).catch(() => null)].filter((h): h is Hit => h !== null)
        : (await searchOff(clean(w.name), w.brand).catch(() => [] as Hit[]))
            .filter((h) => labelSimilarity(`${w.brand ?? ""} ${w.name}`, `${h.brand ?? ""} ${h.name}`) >= 0.5)
            .slice(0, 3);
      for (const h of hits) {
        if (byEan.has(eanKey(h.ean))) continue;
        const c: Candidate = { ...h, source: "linkup" };
        byEan.set(eanKey(h.ean), c);
        extra.push(c);
      }
    }
    await Promise.all(extra.map(async (c) => (c.reference = await referencePrice(c.ean, input.chain, input.excludeProofId).catch(() => null))));
    if (debug) debug.pool = [...byEan.keys()];
    if (extra.length) ranked = rank([...shortlist, ...extra], rankInput);
  }

  // La carte affiche la photo du 1er : si la recherche ne l'a pas donnée, on la prend sur la fiche produit.
  if (ranked.candidates[0]) ranked.candidates[0] = await withImage(ranked.candidates[0]);
  return { ...ranked, searched_at: new Date().toISOString() };
}
