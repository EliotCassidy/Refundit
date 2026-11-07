// Classement des candidats. Fonction pure.
// Le libellé du ticket est la seule vraie preuve : c'est lui qui pèse le plus. L'hypothèse du LLM (guess)
// aide à comprendre les abréviations ; elle ne devient jamais un résultat.
// Barème repris du prototype Python (~/Documents/hackaton/resolve.py), sur 100 :
//   mots du libellé retrouvés (30) + nom proche du « type + variante » du LLM (20)
//   + marque lue sur le ticket (20) ou supposée : marque du LLM / de l'enseigne (15)
//   + format identique (15), inconnu (7), différent (0)
//   + prix de référence à 10 % près (15), à 25 % (8), inconnu (5), plus loin (0)
//   − 15 si le type de produit écrit sur le ticket n'est pas dans le nom du candidat
//   + 30 si d'autres clients ont déjà confirmé ce produit pour ce libellé (cache product_matches).
import type { Product, ProductCandidates } from "@/lib/shared/types";
import { editDistance, labelSimilarity, normalize, sameWord, tokens } from "../text";
import { parseSizes, sizesMatch } from "./ean";
import type { Guess } from "./expand";
import type { ReferencePrice } from "./prices";

/** web : force (0-1) de la preuve web, quand la recherche Linkup a nommé ce produit pour ce libellé. */
export type Candidate = Product & { reference?: ReferencePrice; confirmations?: number; web?: number };

export type RankInput = {
  rawLabel: string;
  guess: Guess | null;
  chain: string | null;
  unitPriceCents: number | null; // prix unitaire payé AVANT remise (comparé à un prix normal)
  registryBrand?: string | null; // marque du registre lue sur le ticket (resolveBrand), pour le garde-fou de validation auto
};

// Marques de distributeur : uniquement les plus sûres (la recherche « MDD » du brief).
const PRIVATE_LABELS: [RegExp, string][] = [
  [/CARREFOUR/, "Carrefour"], [/LECLERC/, "Marque Repère"], [/AUCHAN/, "Auchan"], [/MONOP/, "Monoprix"],
  [/FRANPRIX/, "Franprix"], [/CASINO/, "Casino"], [/BIOCOOP/, "Biocoop"], [/NATURALIA/, "Naturalia"],
  [/\bCORA\b/, "Cora"], [/(SUPER|HYPER) U\b|\bU EXPRESS\b|^U$/, "U"],
];

export function privateLabel(chain: string | null): string | null {
  const c = normalize(chain ?? "");
  return PRIVATE_LABELS.find(([re]) => re.test(c))?.[1] ?? null;
}

export const isSizeToken = (t: string) => /^\d+([.,]\d+)?(G|GR|KG|CL|ML|L|X\d+)?$|^X\d+$|^\d+X\d+/.test(t);
const singular = (w: string) => w.replace(/S$/, "");
const euros = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;

/** Mots utiles du libellé : sans formats (190G, 6X25CL), nombres ni lettres seules. */
export function labelWords(rawLabel: string): string[] {
  return tokens(rawLabel).filter((t) => t.length >= 2 && !/^\d/.test(t) && !isSizeToken(t));
}

/** Le mot du libellé (souvent tronqué : TRADITIO) se retrouve-t-il ? Préfixe, pluriel, ou très proche (≥ 85 %). */
export function wordHit(t: string, words: string[]): boolean {
  return words.some((w) => {
    if (sameWord(t, w) || singular(t) === singular(w)) return true;
    return t.length >= 4 && 1 - editDistance(t, w) / Math.max(t.length, w.length) >= 0.85;
  });
}

const initials = (brand: string) => {
  const words = tokens(brand);
  return words.length >= 2 ? words.map((w) => w[0]).join("") : null;
};

/** La marque est-elle écrite sur le ticket : collée (SAUPIQUET), en initiales (LPM) ou chaque mot ≥ 4 lettres retrouvé ? */
function brandWrittenIn(brand: string | null, rawLabel: string): boolean {
  if (!brand) return false;
  const all = tokens(rawLabel);
  const long = labelWords(rawLabel).filter((t) => t.length >= 4);
  return brand.split(",").some((b) => {
    const words = tokens(b);
    if (!words.length) return false;
    if (all.includes(words.join("")) || all.includes(initials(b) ?? "\0")) return true;
    const significant = words.filter((w) => w.length >= 4);
    return significant.length > 0 && significant.every((w) => long.some((t) => wordHit(t, [w])));
  });
}

// +15 : réglé sur npm run eval:identify -- --linkup-cached (2026-11-07 : 10 → top 5 57,9 %, 15 → 59,2 %, 20 → 59,2 % mais 1er 38,2 %).
const WEB_BONUS = 15;
/** Produit déjà choisi à la main par des clients pour ce libellé, chez cette enseigne. */
export const CONFIRMED_BONUS = 30;
export const WEB_REASON = "nommé par la recherche web pour ce libellé";

type Scored = Candidate & { score: number; reasons: string[]; flags: Set<string>; gap: number | null };

function score(c: Candidate, input: RankInput): Scored {
  const reasons: string[] = [];
  const flags = new Set<string>();
  const brandName = `${c.brand ?? ""} ${c.name}`;

  // 1) Mots du libellé retrouvés dans la marque (ou ses initiales) + le nom (30)
  const words = labelWords(input.rawLabel);
  const candidateWords = tokens(brandName);
  const brandInitials = (c.brand ?? "").split(",").map(initials).filter(Boolean);
  const covered = words.filter((t) => wordHit(t, candidateWords) || brandInitials.includes(t)).length;
  const coverage = words.length ? covered / words.length : 0;
  reasons.push(`${Math.round(100 * coverage)} % des mots du ticket retrouvés`);

  // 2) Nom proche de l'interprétation du LLM : type + variante (20)
  const want = [input.guess?.product_type, input.guess?.variant].filter(Boolean).join(" ");
  const llmSim = want ? labelSimilarity(want, c.name) : 0;

  // 3) Marque : lue sur le ticket (20), sinon supposée (15) : marque du LLM ou de l'enseigne
  const mdd = privateLabel(input.chain);
  const read = brandWrittenIn(c.brand, input.rawLabel);
  const guessed =
    !read &&
    (Boolean(c.web) || // nommé sur le web pour ce libellé chez l'enseigne (comme dans le prototype Python)
      [input.guess?.brand, mdd].some((b) => b && c.brand && (normalize(c.brand).includes(normalize(b)) || labelSimilarity(b, c.brand) >= 0.8)));
  const brandPts = read ? 20 : guessed ? 15 : 0;
  if (read) reasons.push(`marque ${c.brand} lue sur le ticket`);
  else if (guessed) {
    reasons.push(c.web ? `marque ${c.brand ?? "?"} trouvée sur le web pour ce libellé` : `marque ${c.brand} supposée (absente du ticket)`);
    flags.add("marque supposée");
  } else flags.add("marque différente ou inconnue");

  // 4) Format (15 identique, 7 inconnu, 0 différent)
  const labelSizes = parseSizes(input.rawLabel);
  const candidateSizes = parseSizes(`${c.quantity ?? ""} ${c.name}`);
  let fmt = 7;
  if (labelSizes.length && candidateSizes.length) {
    fmt = sizesMatch(labelSizes, candidateSizes) ? 15 : 0;
    if (fmt) reasons.push(`même format (${c.quantity ?? "nom"})`);
    else {
      reasons.push(`format différent (${c.quantity ?? "?"})`);
      flags.add("format différent");
    }
  }

  // 5) Prix payé comparé au prix de référence Open Prices (15 / 8 / 5 inconnu / 0)
  let pricePts = 5;
  let gap: number | null = null;
  if (c.reference && input.unitPriceCents) {
    gap = Math.abs(c.reference.cents - input.unitPriceCents) / input.unitPriceCents;
    pricePts = gap <= 0.1 ? 15 : gap <= 0.25 ? 8 : 0;
    if (gap > 0.25) flags.add("prix éloigné");
    const where = c.reference.scope === "chain" ? "chez l'enseigne" : "partout";
    reasons.push(`prix de référence ${euros(c.reference.cents)} ${where}`);
  }

  // 6) Type de produit écrit sur le ticket (confirmé par le libellé) absent du nom : −15
  const typeWords = tokens(input.guess?.product_type ?? "").filter((w) => w.length >= 4 && words.some((t) => t.length >= 4 && wordHit(t, [w])));
  const typeOk = !typeWords.length || typeWords.some((w) => wordHit(w, tokens(c.name)));
  if (!typeOk) reasons.push(`type « ${input.guess?.product_type} » absent du nom`);

  // 7) Déjà confirmé par d'autres clients pour ce libellé, chez cette enseigne
  const confirmedPts = c.confirmations ? CONFIRMED_BONUS : 0;
  if (c.confirmations) reasons.push(`déjà confirmé ${c.confirmations} fois pour ce libellé`);

  // 8) Nommé par la recherche web (Linkup) pour ce libellé : le web a lu le vrai nom, le libellé abrégé ne suffit pas
  const webPts = Math.round(WEB_BONUS * (c.web ?? 0));
  if (webPts) reasons.push(WEB_REASON);

  const s = 30 * coverage + 20 * llmSim + brandPts + fmt + pricePts - (typeOk ? 0 : 15) + confirmedPts + webPts;
  return { ...c, score: Math.round(s), reasons, flags, gap };
}

/** Premier tri, avant de chercher les prix de référence (les prix déjà connus comptent). */
export const preScore = (c: Candidate, input: RankInput) => score(c, input).score; // avec le prix seulement s'il est déjà connu

/** Deux fiches du même produit : mêmes mots dans le nom, hors nombres (AMBREE ≠ CERISE). */
function sameProduct(a: Candidate, b: Candidate) {
  const words = (c: Candidate) => new Set(tokens(c.name).filter((w) => w.length >= 3 && !/\d/.test(w)));
  const wa = words(a), wb = words(b);
  return wa.size === wb.size && [...wa].every((w) => wb.has(w));
}

export function rank(candidates: Candidate[], input: RankInput): Omit<ProductCandidates, "searched_at"> {
  const scored = candidates
    .map((c) => score(c, input))
    .sort((a, b) => b.score - a.score || (a.gap ?? 9) - (b.gap ?? 9))
    .slice(0, 5);
  const [top] = scored;
  const uncertain_reasons: string[] = [];
  if (!top) uncertain_reasons.push("aucun produit trouvé");
  else {
    if (top.score < 70) uncertain_reasons.push("score faible");
    for (const f of ["marque différente ou inconnue", "marque supposée", "format différent", "prix éloigné"]) {
      if (top.flags.has(f)) uncertain_reasons.push(f);
    }
    if (scored.slice(1).some((c) => top.score - c.score < 3 && !sameProduct(top, c))) uncertain_reasons.push("plusieurs produits à égalité");
  }
  return {
    llm_guess: input.guess?.full_name ?? null,
    candidates: scored.map((c) => ({
      ean: c.ean, brand: c.brand, name: c.name, quantity: c.quantity, image_url: c.image_url, source: c.source,
      score: c.score, reference_price_cents: c.reference?.cents ?? null, reasons: c.reasons,
    })),
    uncertain: uncertain_reasons.length > 0,
    uncertain_reasons,
    confident: isConfident(scored, input.registryBrand),
  };
}

/**
 * Valider directement le 1er ? Seuils calibrés sur npm run eval:identify (2026-11-07, 76 EAN, sans Linkup) :
 * score ≥ 90 → 5/5 justes ; score ≥ 60 avec 20 points d'avance → 3/3 justes. En dessous, < 90 % de justes.
 */
const CONFIDENT_SCORE = 90;
const CONFIDENT_MIN_SCORE = 60;
const CONFIDENT_GAP = 20;

function isConfident(scored: { score: number; brand: string | null; web?: number }[], registryBrand?: string | null): boolean {
  const [top, second] = scored;
  // Pas de validation auto sur une preuve web : les seuils ont été calibrés sans Linkup.
  if (!top || top.web || brandConflict(registryBrand, top.brand)) return false;
  return top.score >= CONFIDENT_SCORE || (top.score >= CONFIDENT_MIN_SCORE && top.score - (second?.score ?? 0) >= CONFIDENT_GAP);
}

/**
 * Garde-fou de la validation AUTOMATIQUE : le ticket nomme une marque du registre (ex. « NOTCOCA » → NotCoca) et le produit
 * proposé est d'une autre marque (ex. Coca-Cola, même prix) → jamais validé tout seul. Un choix manuel n'est pas concerné.
 */
export function brandConflict(registryBrand: string | null | undefined, brand: string | null): boolean {
  if (!registryBrand) return false;
  if (!brand) return true; // marque inconnue : on ne peut pas affirmer que c'est la bonne
  const a = normalize(registryBrand), b = normalize(brand);
  return !(b.includes(a) || a.includes(b) || labelSimilarity(registryBrand, brand) >= 0.8);
}
