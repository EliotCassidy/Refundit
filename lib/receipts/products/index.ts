// Étape 2 : un article coché → top 5 des vrais produits (ProductCandidates, API_CONTRACTS §3).
// Un seul article par appel (la page les lance en parallèle) pour tenir dans maxDuration.
// Requêtes et barème inspirés du prototype Python (~/Documents/hackaton/resolve.py), sans Linkup (payant).
import "server-only";
import { ProductCandidatesSchema, type ProductCandidates } from "@/lib/shared/types";
import { labelSimilarity, normalize } from "../text";
import { expandLabel } from "./expand";
import { chainKey, findConfirmedMatches, labelKey } from "./matches";
import { readCached, writeCached } from "./net";
import { offDocument, quantityVariants, searchObf, searchOff, withImage, type Hit } from "./off";
import { linkupEnabled, webProducts } from "./linkup";
import { parseSizes } from "./ean";
import { referencePrice, samePriceAtChain } from "./prices";
import { brandConflict, labelWords, preScore, privateLabel, rank, wordHit, type Candidate } from "./rank";
import { tokens } from "../text";

export type IdentifyInput = {
  rawLabel: string;
  section: string | null; // rayon imprimé sur le ticket
  chain: string | null; // enseigne imprimée sur le ticket
  unitPriceCents: number | null; // prix unitaire payé, avant remise
  excludeProofId?: number; // éval : ignorer les prix Open Prices de ce ticket
  userQuery?: string; // nom du produit tapé par l'utilisateur quand la première recherche n'a rien donné
  full?: boolean; // recherche complète même si le produit est déjà connu (« Chercher d'autres produits »)
  registryBrand?: string | null; // marque du registre lue sur le ticket (resolveBrand) : garde-fou de la validation auto
};

const LINKUP_BELOW = 70; // secours Linkup si le meilleur score est sous ce seuil (ou aucun candidat)
const PRICED = 20; // nombre de candidats dont on cherche le prix de référence (Open Prices, ~0,2 s chacun)
const BEAUTY_SECTION_RE = /PARFUM|HYGIENE|BEAUTE|SOIN|DENTAIRE|COSMET/;

/** Texte de requête propre : minuscules, sans formats ni nombres. */
const clean = (s: string | null | undefined) =>
  normalize(s ?? "").split(" ").filter((w) => w.length >= 2 && !/\d/.test(w)).join(" ").toLowerCase();

const eanKey = (ean: string) => ean.replace(/^0+/, "");

// Linkup : preuve des produits proposés après le 1er (le 1er vaut 1).
const WEB_LATER = 0.7;
/** Marque renvoyée par Linkup, nettoyée : sans ®/™ ni précisions entre parenthèses ; null si ce n'est pas une marque. */
const webBrand = (b: string | null) => {
  const s = (b ?? "").replace(/[®™©]/g, "").replace(/\([^)]*\)/g, "").trim();
  return s && s !== "?" && s.length <= 40 ? s : null;
};

// Dernier résultat d'identification pour ce libellé chez cette enseigne (lookup_cache), avec ses photos.
const identifyKey = (chain: string | null, rawLabel: string) => `identify:v1|${chainKey(chain)}|${labelKey(rawLabel)}`;

const loadConfirmed = (chain: string | null, rawLabel: string) =>
  findConfirmedMatches(chain, rawLabel).catch((err) => {
    console.error("[product_matches]", err);
    return [];
  });

/**
 * Ce qu'on sait déjà pour ce libellé, SANS aucune recherche (page du ticket et /identify, même ordre) :
 * 1) les produits choisis à la main par des clients (product_matches, manual_confirmations ≥ 1) ;
 * 2) le dernier résultat d'identification en cache pour ce libellé et cette enseigne.
 * null si rien n'est connu. Le garde-fou de marque est toujours réappliqué à la validation automatique.
 */
export async function knownCandidates(chain: string | null, rawLabel: string, registryBrand?: string | null): Promise<ProductCandidates | null> {
  const confirmed = await loadConfirmed(chain, rawLabel);
  if (confirmed.length) {
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
      confident: !brandConflict(registryBrand, candidates[0].brand),
      searched_at: new Date().toISOString(),
    };
  }
  const saved = ProductCandidatesSchema.safeParse(await readCached(identifyKey(chain, rawLabel)).catch(() => undefined));
  if (saved.success && saved.data.candidates.length) {
    const top = saved.data.candidates[0];
    return { ...saved.data, confident: saved.data.confident && !brandConflict(registryBrand, top.brand) };
  }
  return null;
}

/** Ce que l'éval peut lire : EAN trouvés par les recherches (pool), ceux qui ont reçu un prix (shortlist), et si la ligne
 *  est assez faible pour appeler Linkup (weak, même quand Linkup est coupé : sert à compter les appels avant de payer). */
export type IdentifyDebug = {
  pool?: string[];
  shortlist?: string[];
  weak?: boolean;
  web?: { name: string; brand: string | null; ean: string | null; hits: string[] }[]; // réponses Linkup → EAN gardés
};

export async function identifyProduct(input: IdentifyInput, debug?: IdentifyDebug): Promise<ProductCandidates> {
  const t0 = Date.now();
  const times: Record<string, number> = {};
  const lap = (name: string, since: number) => (times[name] = Date.now() - since);

  // Déjà connu (choix manuel ou dernier résultat) : réponse immédiate avec la photo, sans LLM ni recherche.
  if (!input.full && !input.userQuery) {
    const known = await knownCandidates(input.chain, input.rawLabel, input.registryBrand);
    if (known) {
      console.log(`[identify] ${JSON.stringify({ label: input.rawLabel, known: known.candidates[0]?.source, total_ms: Date.now() - t0 })}`);
      return known;
    }
  }
  const confirmed = await loadConfirmed(input.chain, input.rawLabel); // pour le bonus +30 en recherche complète

  // Avec un nom tapé par l'utilisateur, pas besoin de faire deviner le libellé au LLM.
  let since = Date.now();
  const guess = input.userQuery ? null : await expandLabel(input.rawLabel, input.chain, input.section, input.unitPriceCents);
  lap("llm_ms", since);

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

  since = Date.now();
  const results = await Promise.all(searches.map((p) => p.catch((err) => (console.error("[search]", err), [] as Hit[]))));
  lap("search_ms", since);

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
  const rankInput = {
    rawLabel: input.userQuery ?? input.rawLabel, guess, chain: input.chain, unitPriceCents: input.unitPriceCents, registryBrand: input.registryBrand,
  };
  const shortlist = [...byEan.values()].sort((a, b) => preScore(b, rankInput) - preScore(a, rankInput)).slice(0, PRICED);
  if (debug) {
    debug.pool = [...byEan.keys()];
    debug.shortlist = shortlist.map((c) => eanKey(c.ean));
  }
  since = Date.now();
  await Promise.all(
    shortlist.map(async (c) => {
      if (c.reference === undefined) c.reference = await referencePrice(c.ean, input.chain, input.excludeProofId).catch(() => null);
    }),
  );
  lap("prices_ms", since);

  let ranked = rank(shortlist, rankInput);

  // Secours web (Linkup, payant) : seulement si Open Food Facts n'a rien trouvé de bon. Un appel, jamais relancé.
  const weak = !ranked.candidates.length || ranked.candidates[0].score < LINKUP_BELOW;
  if (debug) debug.weak = weak;
  if (linkupEnabled() && weak) {
    since = Date.now();
    const inShortlist = new Set(shortlist.map((c) => eanKey(c.ean)));
    const extra: Candidate[] = [];
    let named = false;
    if (debug) debug.web = [];
    const answers = await webProducts(input.rawLabel, input.chain, input.unitPriceCents);
    for (const [i, w] of answers.entries()) {
      const brand = webBrand(w.brand);
      let hits: Omit<Candidate, "source">[];
      if (w.ean) {
        // EAN écrit tel quel dans une source (vérifié dans linkup.ts) → sa fiche OFF ; absent d'OFF, le produit est
        // proposé tel que la source le décrit (sans photo). L'utilisateur le choisit lui-même : jamais validé tout seul.
        const doc = await offDocument(w.ean).catch(() => null);
        hits = [doc ?? { ean: w.ean, brand, name: w.name, quantity: w.quantity, image_url: null }];
      } else {
        // Sinon on relance Open Food Facts avec le vrai nom trouvé sur le web : dans la marque, puis sans filtre de marque
        // (« MILSANI® », « Bio Bleud » ≠ marques écrites dans OFF ; ~0,5 s de plus, seulement sur les lignes difficiles).
        const text = clean(w.name);
        let found = text ? await searchOff(text, brand).catch(() => [] as Hit[]) : [];
        if (!found.length && brand) found = await searchOff(clean(`${brand} ${w.name}`)).catch(() => [] as Hit[]);
        hits = found.filter((h) => labelSimilarity(`${brand ?? ""} ${w.name}`, `${h.brand ?? ""} ${h.name}`) >= 0.5).slice(0, 3);
      }
      debug?.web?.push({ name: w.name, brand: w.brand, ean: w.ean, hits: hits.map((h) => eanKey(h.ean)) });
      // Force de la preuve web : le 1er produit proposé par Linkup compte plus que les suivants (même avec un EAN lu
      // dans une source : pour « ENDIVE », Linkup liste 5 endives avec leur EAN, ce ne sont que des possibilités).
      const strength = i === 0 ? 1 : WEB_LATER;
      for (const h of hits) {
        const key = eanKey(h.ean);
        let c = byEan.get(key);
        if (!c) {
          c = { ...h, source: "linkup" };
          byEan.set(key, c);
        }
        c.web = Math.max(c.web ?? 0, strength); // un candidat déjà trouvé par OFF et nommé par le web est renforcé
        named = true;
        if (!inShortlist.has(key) && !extra.includes(c)) extra.push(c);
      }
    }
    await Promise.all(extra.map(async (c) => {
      if (c.reference === undefined) c.reference = await referencePrice(c.ean, input.chain, input.excludeProofId).catch(() => null);
    }));
    if (debug) debug.pool = [...byEan.keys()];
    if (named) ranked = rank([...shortlist, ...extra], rankInput);
    lap("linkup_ms", since);
  }

  // La carte affiche la photo du 1er : si la recherche ne l'a pas donnée, on la prend sur la fiche produit.
  since = Date.now();
  if (ranked.candidates[0]) ranked.candidates[0] = await withImage(ranked.candidates[0]);
  lap("image_ms", since);
  const result: ProductCandidates = { ...ranked, searched_at: new Date().toISOString() };

  // Mis en cache par libellé (pas un nom tapé, pas une éval, jamais un résultat vide) : affichage instantané la fois suivante.
  if (!input.userQuery && input.excludeProofId === undefined && result.candidates.length) {
    await writeCached(identifyKey(input.chain, input.rawLabel), result).catch((err) => console.error("[identify cache]", err));
  }
  console.log(`[identify] ${JSON.stringify({ label: input.rawLabel, total_ms: Date.now() - t0, ...times, candidates: result.candidates.length })}`);
  return result;
}
