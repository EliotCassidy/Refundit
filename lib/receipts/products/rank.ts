// Classement des candidats. Fonction pure.
// Le libellé du ticket est la seule vraie preuve : c'est lui qui pèse le plus. L'hypothèse du LLM (guess)
// aide seulement à comprendre les abréviations et à repérer la marque / le type ÉCRITS sur le ticket.
import type { Product, ProductCandidates } from "@/lib/shared/types";
import { normalize, sameWord, tokens } from "../text";
import { parseSizes, sizesMatch } from "./ean";
import type { Guess } from "./expand";
import type { ReferencePrice } from "./prices";

export type Candidate = Product & { reference?: ReferencePrice; confirmations?: number };

export type RankInput = {
  rawLabel: string;
  guess: Guess | null;
  chain: string | null;
  unitPriceCents: number | null; // prix unitaire payé AVANT remise (comparé à un prix normal)
};

// Marques de distributeur : uniquement les plus sûres (la recherche « MDD » du brief).
const PRIVATE_LABELS: [RegExp, string][] = [
  [/CARREFOUR/, "Carrefour"], [/LECLERC/, "Marque Repère"], [/AUCHAN/, "Auchan"], [/MONOPRIX/, "Monoprix"],
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

/** La marque du candidat est-elle écrite sur le ticket (en entier, mot par mot, collée ou en initiales) ? */
function brandWrittenIn(brand: string | null, labelTokens: string[]): boolean {
  if (!brand) return false;
  const words = tokens(brand);
  if (!words.length) return false;
  const glued = words.join(""); // "SAUPIQUET", "U", "LEPETITMARSEILLAIS"
  const initials = words.length >= 2 ? words.map((w) => w[0]).join("") : null; // "LPM"
  if (labelTokens.some((t) => t === glued || t === initials)) return true;
  const long = words.filter((w) => w.length >= 3); // chaque mot de la marque, en entier ou abrégé
  return long.length > 0 && long.every((w) => labelTokens.some((t) => sameWord(t, w)));
}

type Scored = Candidate & { score: number; reasons: string[]; flags: Set<string> };

function score(c: Candidate, input: RankInput): Scored {
  const reasons: string[] = [];
  const flags = new Set<string>();
  const labelTokens = tokens(input.rawLabel);
  const words = labelTokens.filter((t) => t.length >= 2 && !isSizeToken(t));
  const candidateWords = tokens(`${c.name} ${c.brand ?? ""} ${c.quantity ?? ""}`);
  const found = (w: string) => candidateWords.some((cw) => sameWord(w, cw) || singular(w) === singular(cw));
  let s = 0;

  // 1) Mots du libellé retrouvés dans le candidat (le libellé brut d'abord, sinon son développement)
  if (words.length) {
    let matched = 0;
    for (const w of words) {
      if (found(w)) matched += 1;
      else {
        const expanded = input.guess?.words.find((x) => normalize(x.raw) === w)?.expanded;
        if (expanded && tokens(expanded).some((e) => e.length >= 3 && found(e))) matched += 0.8;
      }
    }
    s += 50 * (matched / words.length);
    reasons.push(`${Math.round((100 * matched) / words.length)} % des mots du ticket retrouvés`);
  }

  // 2) Marque : lue sur le ticket plutôt que supposée
  const brandRaw = input.guess?.brand_raw ? normalize(input.guess.brand_raw) : null;
  const ticketHasBrand = brandRaw !== null && labelTokens.includes(brandRaw.split(" ")[0]);
  const mdd = privateLabel(input.chain);
  if (brandWrittenIn(c.brand, labelTokens)) {
    s += 15;
    reasons.push(`marque ${c.brand} lue sur le ticket`);
  } else if (ticketHasBrand) {
    s -= 15;
    reasons.push(`marque différente de celle du ticket (${input.guess?.brand})`);
    flags.add("marque différente");
  } else if (mdd && c.brand && normalize(c.brand).startsWith(normalize(mdd))) {
    s += 5;
    reasons.push(`marque de l'enseigne (${c.brand}), supposée`);
    flags.add("marque supposée");
  } else {
    flags.add("marque non lue sur le ticket");
  }

  // 3) Format (190G, 6X25CL…)
  const labelSizes = parseSizes(input.rawLabel);
  const candidateSizes = parseSizes(`${c.quantity ?? ""} ${c.name}`);
  if (labelSizes.length && candidateSizes.length) {
    if (sizesMatch(labelSizes, candidateSizes)) {
      s += 15;
      reasons.push(`même format (${c.quantity ?? "nom"})`);
    } else {
      s -= 15;
      reasons.push(`format différent (${c.quantity ?? "?"})`);
      flags.add("format différent");
    }
  }

  // 4) Prix payé comparé au prix de référence Open Prices
  if (c.reference && input.unitPriceCents) {
    const gap = Math.abs(input.unitPriceCents - c.reference.cents) / c.reference.cents;
    const where = c.reference.scope === "chain" ? "chez l'enseigne" : "partout";
    if (gap <= 0.1) s += 15;
    else if (gap <= 0.25) s += 7;
    else if (gap > 0.5) {
      s -= 10;
      flags.add("prix éloigné");
    }
    reasons.push(`prix de référence ${euros(c.reference.cents)} ${where} (${c.reference.n} relevé${c.reference.n > 1 ? "s" : ""})`);
  }

  // 5) Pénalité si le type de produit écrit sur le ticket n'est pas dans le nom
  const typeRaw = input.guess?.product_type_raw ? normalize(input.guess.product_type_raw) : null;
  if (typeRaw && labelTokens.includes(typeRaw.split(" ")[0])) {
    const nameWords = tokens(c.name);
    const typeWords = [typeRaw, ...tokens(input.guess?.product_type ?? "")].filter((w) => w.length >= 3);
    const ok = typeWords.some((t) => nameWords.some((n) => sameWord(t, n) || singular(t) === singular(n)));
    if (!ok) {
      s -= 20;
      reasons.push(`type « ${input.guess?.product_type ?? typeRaw} » absent du nom`);
    }
  }

  // 6) Déjà confirmé par d'autres clients pour ce libellé, chez cette enseigne
  if (c.confirmations) {
    s += 30;
    reasons.push(`déjà confirmé ${c.confirmations} fois pour ce libellé`);
  }

  return { ...c, score: Math.round(s), reasons, flags };
}

/** Score sans les prix (pour choisir les candidats dont on va chercher le prix de référence). */
export const preScore = (c: Candidate, input: RankInput) => score({ ...c, reference: undefined }, input).score;

export function rank(candidates: Candidate[], input: RankInput): Omit<ProductCandidates, "searched_at"> {
  const scored = candidates.map((c) => score(c, input)).sort((a, b) => b.score - a.score).slice(0, 5);
  const [top, second] = scored;
  const uncertain_reasons: string[] = [];
  if (!top) uncertain_reasons.push("aucun produit trouvé");
  else {
    if (top.score < 50) uncertain_reasons.push("score faible");
    if (second && top.score - second.score < 5) uncertain_reasons.push("plusieurs produits à égalité");
    for (const f of ["marque différente", "marque supposée", "marque non lue sur le ticket", "format différent", "prix éloigné"]) {
      if (top.flags.has(f)) uncertain_reasons.push(f);
    }
  }
  return {
    llm_guess: input.guess?.full_name ?? null,
    candidates: scored.map((c) => ({
      ean: c.ean,
      brand: c.brand,
      name: c.name,
      quantity: c.quantity,
      image_url: c.image_url,
      source: c.source,
      score: c.score,
      reference_price_cents: c.reference?.cents ?? null,
      reasons: c.reasons,
    })),
    uncertain: uncertain_reasons.length > 0,
    uncertain_reasons,
  };
}
