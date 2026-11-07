// EAN et formats : fonctions pures.

/** EAN-8 / UPC-A (12) / EAN-13 / GTIN-14 avec une clé de contrôle GS1 valide. */
export function isValidEan(code: string | null | undefined): code is string {
  if (!code || !/^(\d{8}|\d{12,14})$/.test(code)) return false;
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  // De droite à gauche (hors clé) : poids 3, 1, 3, 1…
  const total = digits.reverse().reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (total % 10)) % 10 === check;
}

export type Size = { total: number; unit: "g" | "ml" | "u"; per?: true }; // en g, ml ou unités ; per = taille d'une unité d'un lot

const UNITS: Record<string, [number, Size["unit"]]> = {
  kg: [1000, "g"], g: [1, "g"], gr: [1, "g"], mg: [0.001, "g"],
  l: [1000, "ml"], cl: [10, "ml"], ml: [1, "ml"],
};

/**
 * Formats lus dans un texte : "190G", "1,5L", "6X25CL" (= 1500 ml et 250 ml), "800 g (8 x 100 g)", "X30CAPS", "4X100G".
 * On renvoie le total ET la taille unitaire des lots, pour accepter les deux façons de l'écrire.
 */
export function parseSizes(text: string | null | undefined): Size[] {
  if (!text) return [];
  const s = text.toLowerCase().replace(/,/g, ".");
  const out: Size[] = [];
  const re = /(?:(\d+)\s*[x×*]\s*)?(\d+(?:\.\d+)?)\s*(kg|gr|g|mg|cl|ml|l)(?![a-z])/g;
  for (const m of s.matchAll(re)) {
    const [factor, unit] = UNITS[m[3]];
    const one = parseFloat(m[2]) * factor;
    const count = m[1] ? parseInt(m[1], 10) : 1;
    out.push({ total: Math.round(one * count * 100) / 100, unit });
    if (count > 1) out.push({ total: Math.round(one * 100) / 100, unit, per: true });
  }
  // Nombre de pièces : "X30", "x 30 capsules", "30 CAPS", "lot de 6"
  for (const m of s.matchAll(/(?:^|[^a-z0-9.])x\s*(\d+)(?![\d.]*\s*(?:kg|gr|g|mg|cl|ml|l)(?![a-z]))|(\d+)\s*(?:caps|capsules|dosettes|sachets|pieces|pcs|tranches|oeufs|rouleaux)|lot de (\d+)/g)) {
    out.push({ total: parseInt(m[1] ?? m[2] ?? m[3], 10), unit: "u" });
  }
  return out;
}

/**
 * Deux formats se correspondent s'ils ont la même unité et à peu près la même valeur (±3 %).
 * Deux lots se comparent sur leur total (4 x 100 g ≠ 8 x 100 g) ; un lot face à un format simple peut
 * aussi se comparer sur la taille d'une unité (6X25CL ~ "25 cl").
 */
export function sizesMatch(a: Size[], b: Size[]): boolean {
  const close = (x: Size, y: Size) => x.unit === y.unit && Math.abs(x.total - y.total) <= 0.03 * Math.max(x.total, y.total);
  const multi = (s: Size[]) => s.some((x) => x.per);
  const usable = (s: Size[], other: Size[]) => (multi(s) && multi(other) ? s.filter((x) => !x.per) : s);
  return usable(a, b).some((x) => usable(b, a).some((y) => close(x, y)));
}
