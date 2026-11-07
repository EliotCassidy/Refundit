// Interprétation du ticket. Le modèle RECOPIE (TranscriptionSchema), ce fichier INTERPRÈTE :
// rien ici ne dépend du modèle utilisé. Fonctions pures, testables sans réseau.
// Aucune règle par enseigne : les cas ambigus sont tranchés par l'arithmétique du ticket.
import { z } from "zod";
import { labelSimilarity, normalize } from "./text";

// ---------------------------------------------------------------------------
// Ce que le modèle recopie
// ---------------------------------------------------------------------------
const RawValue = z.union([z.string(), z.number()]).nullish();

export const TranscriptionSchema = z.object({
  store: z.object({ chain: z.string().nullish(), name: z.string().nullish() }).nullish(),
  date_raw: z.string().nullish(),
  time_raw: z.string().nullish(),
  lines: z.array(
    z.object({
      section: z.string().nullish(), // en-tête de rayon au-dessus de la ligne
      mark: z.string().nullish(), // lettre isolée dans la marge ("T" = titre-restaurant)
      text: z.string(), // texte de la ligne, recopié exactement
      qty: RawValue, // quantité telle qu'imprimée
      amount: RawValue, // montant signé tel qu'imprimé ("1,99", "-0,50", "0,50-")
    }),
  ),
});
export type Transcription = z.infer<typeof TranscriptionSchema>;

// ---------------------------------------------------------------------------
// Ce que l'on en tire
// ---------------------------------------------------------------------------
export type ExtractedItem = {
  position: number;
  raw_label: string; // recopié EXACTEMENT, jamais corrigé
  section: string | null;
  mark: string | null;
  qty: number; // 1 si non imprimée, 1 pour un article pesé
  qty_source: "default" | "column" | "detail"; // d'où vient la quantité
  weight_kg: number | null;
  unit_price_cents: number | null;
  price_cents: number; // montant de la ligne, avant remise
  discount_cents: number; // remise rattachée, positive
  discount_pct: number | null;
  discount_text: string | null;
  paid_cents: number; // price − discount
};

export type Totals = {
  gross_cents: number | null; // total avant remises
  discounts_cents: number | null; // total des remises (positif)
  paid_cents: number | null; // net payé
  n_items: number | null; // nombre d'articles (unités)
  n_lines: number | null; // nombre de lignes d'articles
};

/** Lignes négatives après le premier total : récap des remises déjà comptées, ou vraies remises ? */
export type TailMode = "none" | "recap" | "applied" | "undetermined";

export type Interpretation = {
  store: { chain: string | null; name: string | null };
  date: string | null; // AAAA-MM-JJ
  time: string | null; // HH:MM
  date_raw: string | null;
  time_raw: string | null;
  items: ExtractedItem[];
  global_discounts: { text: string; amount_cents: number }[]; // remises non rattachées
  tail_discounts: { text: string; amount_cents: number }[];
  tail_mode: TailMode;
  printed: Totals; // totaux imprimés sur le ticket (null = absent)
  paid_source: "total" | "payments" | null;
  notes: string[]; // décisions prises par l'arithmétique (pour la relecture)
};

// ---------------------------------------------------------------------------
// Nombres
// ---------------------------------------------------------------------------
/**
 * "1,99" → 199 · "-0,50" / "0,50-" / "(0,50)" → -50 · "4,17 € 1" (code TVA derrière) → 417
 * · "12" → 1200 · illisible → null.
 */
export function parseCents(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : null;
  const s = v.replace(/[−–]/g, "-").replace(/€|EUR/gi, " ");
  const m = s.match(/(\(|-)?\s*(\d+)[.,](\d{1,2})(?!\d)\s*(-|\))?/);
  if (m) {
    const cents = parseInt(m[2], 10) * 100 + parseInt(m[3].padEnd(2, "0"), 10);
    return m[1] || m[4] ? -cents : cents;
  }
  const n = s.match(/^\s*(-)?\s*(\d+)\s*(-)?\s*$/); // entier seul
  return n ? (n[1] || n[3] ? -1 : 1) * parseInt(n[2], 10) * 100 : null;
}

function parseNumber(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const n = parseFloat(v.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// Dates et heures
// ---------------------------------------------------------------------------
const MONTHS: [RegExp, number][] = [
  [/^jan/, 1], [/^fev|^feb/, 2], [/^mar/, 3], [/^avr|^apr/, 4], [/^mai|^may/, 5], [/^juin|^jun/, 6],
  [/^juil|^jul/, 7], [/^aou|^aug/, 8], [/^sep/, 9], [/^oct/, 10], [/^nov/, 11], [/^dec/, 12],
];

function isoDate(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** JJ/MM/AA(AA) (séparateurs / . -), AAAA-MM-JJ, "17 décembre 2025", "14 Mar. 2026" → AAAA-MM-JJ. */
export function parseDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  let m = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return isoDate(+m[1], +m[2], +m[3]);
  m = s.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{4}|\d{2})(?!\d)/);
  if (m) return isoDate(+m[3], +m[2], +m[1]);
  m = s.match(/(\d{1,2})(?:er)?\s*([a-z]{3,9})\.?\s*(\d{4}|\d{2})(?!\d)/);
  if (m) {
    const month = MONTHS.find(([re]) => re.test(m![2]))?.[1];
    if (month) return isoDate(+m[3], month, +m[1]);
  }
  return null;
}

/** "13:55" ou "13h55" → "13:55". */
export function parseTime(raw: string | null | undefined): string | null {
  const m = raw?.match(/(\d{1,2})\s*[:hH]\s*(\d{2})/);
  if (!m || +m[1] > 23 || +m[2] > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

/** Date + heure locales (Europe/Paris) → ISO 8601 avec décalage. Sans heure imprimée : 12:00. */
export function toPurchasedAt(date: string | null, time: string | null): string | null {
  if (!date) return null;
  const local = `${date}T${time ?? "12:00"}:00`;
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Paris", timeZoneName: "longOffset" })
    .formatToParts(new Date(`${local}Z`))
    .find((p) => p.type === "timeZoneName")?.value.replace("GMT", "");
  return `${local}${offset || "+00:00"}`;
}

// ---------------------------------------------------------------------------
// Reconnaissance des lignes (sur le texte normalisé : majuscules, sans accents)
// ---------------------------------------------------------------------------
const TOTAL_RE = /\bTOTA(L|UX)\b|\bA PAYER\b|\bMONTANT DU\b/;
const COUNT_RE = /\b(NB|NBR|NOMBRE)\b.*\bART|\bARTICLES?\s*\d+$|\b\d+\s*ARTICLES?\b/;
const COUNT_STRIP_RE = /\b(NB|NBR|NOMBRE)\b( DE)?( LIGNES?)?( D)? ART\w*( \d+)?|\b\d+\s*ARTICLES?( S)?\b|\bARTICLES?\s*\d+\b/g;
const PAID_STRONG_RE = /\bA PAYER\b|\bMONTANT DU\b/;
const PAID_WEAK_RE = /^TOTAL( TTC| EUR| EUROS)?$/;
const GROSS_RE = /\bSOUS TOTAL\b|^S TOTAL\b|\bTOTAL (AVANT|BRUT)\b|\bTOTAL HORS (PROMO\w*|REMISES?)\b/;
const DISCOUNT_TOTAL_RE = /\bTOTAL (DES )?(REMISES?|ECONOMIES?|REDUCTIONS?)\b|\bVOS ECONOMIES\b|\bECONOMIES? REALISEES?\b/;
const TVA_RE = /\bTOTAL TVA\b|^TVA$/;
const NOT_PAID_RE = /\bTVA\b|\bHT\b|REMISE|ECONOMI|AVANTAGE|FIDELI|POINTS?\b|CAGNOTTE/;
const PAYMENT_RE = /\bCB\b|\bCARTE\b|VISA|MASTERCARD|MAESTRO|AMEX|SANS CONTACT|ESPECES|CHEQUE|TITRE RESTAURANT|TICKET RESTAU|\bTR\b/;
const CHANGE_RE = /\bRENDU\b|\bMONNAIE\b/;
const DISCOUNT_WORD_RE = /^(REMISE|REM|REDUC\w*|BON|COUPON|AVANTAGE|PROMO)\b/;

// Lignes de détail sous un article (sur le texte brut)
const DETAIL_RE = /^\s*(\d+)\s*[x×*]\s*(\d+[.,]\d{2})\s*(?:€|eur)?\s*$/i; // "2 x 1,99"
const WEIGHT_RE = /^\s*(\d+[.,]\d+)\s*kg\s*[x×*@]\s*(\d+[.,]\d{2})\s*(?:€|eur)?\s*\/\s*kg/i; // "0,456 kg x 12,90 €/kg"
const QTY_ONLY_RE = /^\s*(\d+(?:[.,]\d+)?)\s*(kg)?\s*[x×*]\s*$/i; // "1 x" ou "0,302 kg x", le montant = prix unitaire

/** Ligne de détail → quantité ou poids, prix unitaire, et montant de ligne s'il est imprimé. */
function parseDetail(text: string, amount: number | null) {
  let m = text.match(DETAIL_RE);
  if (m) return { qty: parseInt(m[1], 10), weight_kg: null, unit: parseCents(m[2]), total: amount };
  m = text.match(WEIGHT_RE);
  if (m) return { qty: 1, weight_kg: parseNumber(m[1]), unit: parseCents(m[2]), total: amount };
  m = text.match(QTY_ONLY_RE);
  if (m && amount != null && amount > 0) {
    const n = parseNumber(m[1])!;
    return m[2] ? { qty: 1, weight_kg: n, unit: amount, total: null } : { qty: n, weight_kg: null, unit: amount, total: null };
  }
  return null;
}

function parseCount(text: string, qty: unknown, amount: unknown): number | null {
  const m = normalize(text).match(/(\d+)\s*ART|ART\w*\D*?(\d+)/);
  if (m) return parseInt(m[1] ?? m[2], 10);
  for (const v of [qty, amount]) {
    const n = parseNumber(v as string | number | null);
    if (n != null && Number.isInteger(n)) return n;
  }
  return null;
}

function pctOf(text: string): number | null {
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*%/);
  return m ? parseFloat(m[1].replace(",", ".")) : null;
}

// ---------------------------------------------------------------------------
// Rattachement strict d'une remise de fin de ticket à un article
// ---------------------------------------------------------------------------
const ATTACH_MIN = 0.5; // ressemblance minimale
const ATTACH_MARGIN = 0.2; // avance minimale sur le deuxième article

/** Article auquel rattacher la remise, ou null (remise globale) si ce n'est pas net. */
export function attachDiscount(text: string, items: ExtractedItem[]): ExtractedItem | null {
  const cleaned = text.replace(/remise|rem\b|promo|r[ée]duc\w*|imm[ée]diate|-?\d+([.,]\d+)?\s*%|-?\d+[.,]\d{2}/gi, " ");
  const scores = items.map((it) => labelSimilarity(cleaned, it.raw_label));
  const order = scores.map((s, i) => [s, i]).sort((a, b) => b[0] - a[0]);
  const [best, second] = [order[0]?.[0] ?? 0, order[1]?.[0] ?? 0];
  return best >= ATTACH_MIN && best - second >= ATTACH_MARGIN ? items[order[0][1]] : null;
}

function addDiscount(item: ExtractedItem, text: string, cents: number) {
  item.discount_cents += cents;
  item.discount_text = item.discount_text ? `${item.discount_text} | ${text}` : text;
  item.discount_pct ??= pctOf(text);
  item.paid_cents = item.price_cents - item.discount_cents;
}

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

function newItem(
  position: number,
  l: { text: string; section?: string | null; mark?: string | null },
  price: number,
  qty: number,
  qty_source: ExtractedItem["qty_source"],
  unit: number | null,
  weight_kg: number | null,
): ExtractedItem {
  return {
    position, raw_label: l.text, section: l.section ?? null, mark: l.mark ?? null,
    qty, qty_source, weight_kg, unit_price_cents: unit, price_cents: price,
    discount_cents: 0, discount_pct: null, discount_text: null, paid_cents: price,
  };
}

// ---------------------------------------------------------------------------
// Interprétation complète
// ---------------------------------------------------------------------------
export function interpret(t: Transcription): Interpretation {
  const lines = t.lines.map((l) => ({ ...l, n: normalize(l.text), cents: parseCents(l.amount) }));
  const notes: string[] = [];

  // Les articles s'arrêtent à la première ligne de total (ou de nombre d'articles).
  let stop = lines.findIndex((l) => TOTAL_RE.test(l.n) || COUNT_RE.test(l.n));
  if (stop < 0) stop = lines.length;

  const items: ExtractedItem[] = [];
  const global_discounts: { text: string; amount_cents: number }[] = [];
  let pendingLabel: (typeof lines)[number] | null = null; // libellé dont le montant est sur la ligne suivante

  for (const l of lines.slice(0, stop)) {
    const last = items.at(-1);

    // Ligne de détail "2 x 1,99", "0,456 kg x 12,90 €/kg", ou "1 x" + prix unitaire
    const d = parseDetail(l.text, l.cents);
    if (d) {
      const n = d.weight_kg ?? d.qty;
      if (last && !pendingLabel && d.unit != null && Math.abs(n * d.unit - last.price_cents) <= 1) {
        // le détail colle avec le montant de l'article au-dessus
        Object.assign(last, { qty: d.qty, qty_source: "detail", unit_price_cents: d.unit, weight_kg: d.weight_kg });
      } else if (pendingLabel && (d.total != null || d.unit != null)) {
        const price = d.total ?? Math.round(n * d.unit!);
        items.push(newItem(items.length, pendingLabel, price, d.qty, "detail", d.unit, d.weight_kg));
        pendingLabel = null;
      }
      continue;
    }

    if (l.cents == null) {
      pendingLabel = l; // en-tête ou libellé sur deux lignes : décidé à la ligne suivante
      continue;
    }
    pendingLabel = null;

    // Remise : montant négatif (ou mot "REMISE…" en tête de ligne), rattachée à l'article juste au-dessus
    if (l.cents < 0 || DISCOUNT_WORD_RE.test(l.n)) {
      const cents = Math.abs(l.cents);
      if (last) addDiscount(last, l.text, cents);
      else global_discounts.push({ text: l.text, amount_cents: cents });
      continue;
    }

    const qty = parseNumber(l.qty);
    const q = qty && qty > 0 && Number.isInteger(qty) ? qty : 1;
    const unit = q > 1 && l.cents % q === 0 ? l.cents / q : q === 1 ? l.cents : null;
    items.push(newItem(items.length, l, l.cents, q, q > 1 ? "column" : "default", unit, null));
  }

  // Après le premier total : totaux imprimés, paiements, lignes négatives
  const printed: Totals = { gross_cents: null, discounts_cents: null, paid_cents: null, n_items: null, n_lines: null };
  let paidStrong: number | null = null, paidWeak: number | null = null, grossFromSubtotal = false, tva: number | null = null;
  const payments: number[] = [], change: number[] = [], amounts: number[] = [];
  const tail_discounts: { text: string; amount_cents: number }[] = [];

  for (const l of lines.slice(stop)) {
    // "6 ARTICLE(S)  TOTAL A PAYER  12,65" : la même ligne donne le nombre d'articles ET un total.
    const isCount = COUNT_RE.test(l.n);
    if (isCount) {
      const n = parseCount(l.text, l.qty, l.amount);
      if (/\bLIGNES?\b/.test(l.n)) printed.n_lines ??= n;
      else printed.n_items ??= n;
    }
    if (l.cents == null || (isCount && !TOTAL_RE.test(l.n))) continue;
    amounts.push(l.cents);
    const label = isCount ? l.n.replace(COUNT_STRIP_RE, " ").replace(/\s+/g, " ").trim() : l.n;

    if (DISCOUNT_TOTAL_RE.test(label)) printed.discounts_cents ??= Math.abs(l.cents);
    else if (GROSS_RE.test(label)) {
      if (printed.gross_cents == null) grossFromSubtotal = /SOUS TOTAL|^S TOTAL/.test(label);
      printed.gross_cents ??= l.cents;
    } else if (TVA_RE.test(label)) tva ??= l.cents;
    else if (PAID_STRONG_RE.test(label) && !NOT_PAID_RE.test(label)) paidStrong ??= l.cents;
    else if (PAID_WEAK_RE.test(label)) paidWeak ??= l.cents;
    else if (CHANGE_RE.test(label)) change.push(Math.abs(l.cents));
    else if (PAYMENT_RE.test(label)) payments.push(l.cents);
    else if (l.cents < 0 || DISCOUNT_WORD_RE.test(label)) tail_discounts.push({ text: l.text, amount_cents: Math.abs(l.cents) });
  }

  // Un SOUS-TOTAL qui, ajouté à la TVA, redonne un autre total imprimé est un montant hors taxes.
  if (grossFromSubtotal && tva != null && amounts.includes(printed.gross_cents! + tva)) {
    notes.push(`SOUS-TOTAL ${printed.gross_cents} = montant HT (+ TVA ${tva} = un autre total) : pas un total avant remises`);
    printed.gross_cents = null;
  }

  // Net payé : "A PAYER" > "TOTAL" seul > somme des paiements − rendu
  let paid_source: Interpretation["paid_source"] = "total";
  printed.paid_cents = paidStrong ?? paidWeak;
  if (paidStrong != null && paidWeak != null && paidWeak !== paidStrong) printed.gross_cents ??= paidWeak;
  if (printed.paid_cents == null && payments.length) {
    printed.paid_cents = sum(payments) - sum(change);
    paid_source = "payments";
  }
  if (printed.paid_cents == null) paid_source = null;

  const tail = sum(tail_discounts.map((d) => d.amount_cents));
  const net = () =>
    sum(items.map((i) => i.price_cents)) - sum(items.map((i) => i.discount_cents)) - sum(global_discounts.map((d) => d.amount_cents));

  // Quantité en colonne : le montant est soit le total de la ligne, soit le prix unitaire.
  // On garde la lecture « prix unitaire » seulement si c'est elle qui donne total − remises = payé.
  const columnItems = items.filter((i) => i.qty_source === "column");
  if (columnItems.length && printed.paid_cents != null && net() !== printed.paid_cents && net() - tail !== printed.paid_cents) {
    const extra = sum(columnItems.map((i) => i.price_cents * (i.qty - 1)));
    if (net() + extra === printed.paid_cents || net() + extra - tail === printed.paid_cents) {
      for (const i of columnItems) {
        i.unit_price_cents = i.price_cents;
        i.price_cents *= i.qty;
        i.paid_cents = i.price_cents - i.discount_cents;
      }
      notes.push(`quantités en colonne lues comme prix unitaires (${columnItems.map((i) => i.raw_label).join(", ")}) : c'est ce qui redonne le total payé`);
    }
  }

  // Remises de fin : vraies remises ou récap ? On tranche avec total − remises = payé.
  let tail_mode: TailMode = "none";
  if (tail_discounts.length) {
    if (printed.paid_cents == null) tail_mode = "undetermined";
    else if (net() === printed.paid_cents) tail_mode = "recap";
    else if (net() - tail === printed.paid_cents) tail_mode = "applied";
    else tail_mode = "undetermined";

    if (tail_mode === "applied") {
      for (const d of tail_discounts) {
        const item = attachDiscount(d.text, items);
        if (item) addDiscount(item, d.text, d.amount_cents);
        else global_discounts.push(d);
      }
    }
  }

  return {
    store: { chain: t.store?.chain ?? null, name: t.store?.name ?? null },
    date: parseDate(t.date_raw) ?? parseDate(t.time_raw),
    time: parseTime(t.time_raw) ?? parseTime(t.date_raw),
    date_raw: t.date_raw ?? null,
    time_raw: t.time_raw ?? null,
    items,
    global_discounts,
    tail_discounts,
    tail_mode,
    printed,
    paid_source,
    notes,
  };
}
