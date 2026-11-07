// Petites fonctions texte, pures (utilisables partout, y compris dans les évals).

/** Majuscules, sans accents, ponctuation → espaces, espaces simples. */
export function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9%]+/g, " ")
    .trim();
}

export function tokens(s: string): string[] {
  return normalize(s).split(" ").filter(Boolean);
}

/** Deux mots se valent s'ils sont égaux, ou si l'un est l'abréviation (préfixe ≥ 3 lettres) de l'autre. */
export function sameWord(a: string, b: string): boolean {
  if (a === b) return true;
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  return short.length >= 3 && long.startsWith(short);
}

/** Ressemblance entre deux libellés, de 0 à 1 (Dice sur les mots, abréviations tolérées). */
export function labelSimilarity(a: string, b: string): number {
  const ta = tokens(a), tb = tokens(b);
  if (!ta.length || !tb.length) return 0;
  const used = new Set<number>();
  let matches = 0;
  for (const wa of ta) {
    const j = tb.findIndex((wb, k) => !used.has(k) && sameWord(wa, wb));
    if (j >= 0) {
      used.add(j);
      matches++;
    }
  }
  return (2 * matches) / (ta.length + tb.length);
}

/** Distance de Levenshtein (nombre de caractères à changer). */
export function editDistance(a: string, b: string): number {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
