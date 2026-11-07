// Éval de l'étape 1 (extraction du ticket).
//   npm run eval:extract                 tous les tickets, appel au modèle
//   npm run eval:extract -- --runs 3     3 passages par ticket → stabilité
//   npm run eval:extract -- --cached     ré-interprète les transcriptions sauvées (gratuit, sans modèle)
//   npm run eval:extract -- --only 143495,143852
//
// Deux sortes de vérité terrain :
// - tickets/X.<image> + X.expected.json : comparaison champ par champ (raw_label toléré à 2 caractères près) ;
// - tickets/openprices/<id>.<image> + <id>.known.json : vérité partielle (date, prix connus retrouvés).
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { prepareImage } from "../image";
import { parseReceipt, type ReceiptExtraction } from "../parse";
import { interpret, type Transcription } from "../interpret";
import { runChecks } from "../checks";
import { editDistance, normalize } from "../text";

const CACHE = join(process.cwd(), ".cache", "eval");
const IMAGE_RE = /\.(jpe?g|png|webp|heic|heif)$/i;

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => (args.includes(`--${name}`) ? args[args.indexOf(`--${name}`) + 1] : undefined);
const RUNS = Number(value("runs") ?? 1);
const ONLY = value("only")?.split(",");
const CACHED = flag("cached");
const CONCURRENCY = 3;

type Ticket = { id: string; image: string; truthPath: string; kind: "expected" | "known" };

type Score = {
  id: string;
  kind: Ticket["kind"];
  date_ok: boolean | null;
  fields_ok: number; // champs justes (expected) ou prix connus retrouvés (known)
  fields_total: number;
  errors: number; // erreurs de checks restantes
  needs_review: boolean;
  attempts: number;
  ms: number;
  signature: string; // pour la stabilité : articles lus
  details: string[];
};

const cents = (euros: number | null | undefined) => (euros == null ? null : Math.round(euros * 100));

async function listTickets(): Promise<Ticket[]> {
  const out: Ticket[] = [];
  for (const [dir, kind, suffix] of [["tickets", "expected", ".expected.json"], ["tickets/openprices", "known", ".known.json"]] as const) {
    const files = await readdir(dir).catch(() => [] as string[]);
    for (const f of files.filter((f) => IMAGE_RE.test(f))) {
      const id = f.replace(IMAGE_RE, "");
      if (files.includes(id + suffix)) out.push({ id, image: join(dir, f), truthPath: join(dir, id + suffix), kind });
    }
  }
  return out.filter((t) => !ONLY || ONLY.includes(t.id));
}

// ---------------------------------------------------------------------------
// Comparaison avec la vérité terrain
// ---------------------------------------------------------------------------
type Expected = {
  store?: { chain?: string | null; name?: string | null } | string | null;
  date?: string | null;
  time?: string | null;
  items: { raw_label: string; qty?: number; price: number; discount?: number; section?: string | null }[];
  totals?: { gross?: number | null; discounts?: number | null; paid?: number | null; n_items?: number | null };
};

function scoreExpected(x: ReceiptExtraction, e: Expected, details: string[]) {
  let ok = 0, total = 0;
  const check = (name: string, good: boolean, got: unknown, want: unknown) => {
    total++;
    if (good) ok++;
    else details.push(`${name}: lu ${JSON.stringify(got)}, attendu ${JSON.stringify(want)}`);
  };
  const store = typeof e.store === "string" ? { name: e.store } : e.store;
  if (store?.chain !== undefined) check("store.chain", normalize(x.store.chain ?? "") === normalize(store.chain ?? ""), x.store.chain, store.chain);
  if (store?.name !== undefined) check("store.name", normalize(x.store.name ?? "") === normalize(store.name ?? ""), x.store.name, store.name);
  if (e.date !== undefined) check("date", x.date === e.date, x.date, e.date);
  if (e.time !== undefined) check("time", x.time === e.time, x.time, e.time);
  check("nb articles", x.items.length === e.items.length, x.items.length, e.items.length);
  e.items.forEach((want, i) => {
    const got = x.items[i];
    const p = `article ${i} (${want.raw_label})`;
    check(`${p} raw_label`, !!got && editDistance(got.raw_label, want.raw_label) <= 2, got?.raw_label, want.raw_label);
    check(`${p} prix`, got?.price_cents === cents(want.price), got?.price_cents, cents(want.price));
    if (want.qty !== undefined) check(`${p} qté`, got?.qty === want.qty, got?.qty, want.qty);
    if (want.discount !== undefined) check(`${p} remise`, got?.discount_cents === cents(want.discount ?? 0), got?.discount_cents, cents(want.discount));
    if (want.section !== undefined) check(`${p} rayon`, normalize(got?.section ?? "") === normalize(want.section ?? ""), got?.section, want.section);
  });
  const t = e.totals ?? {};
  if (t.paid !== undefined) check("total payé", x.printed.paid_cents === cents(t.paid), x.printed.paid_cents, cents(t.paid));
  if (t.gross !== undefined) check("total avant remises", x.printed.gross_cents === cents(t.gross), x.printed.gross_cents, cents(t.gross));
  if (t.discounts !== undefined) check("total remises", x.printed.discounts_cents === cents(t.discounts), x.printed.discounts_cents, cents(t.discounts));
  if (t.n_items !== undefined) check("nb articles imprimé", x.printed.n_items === t.n_items, x.printed.n_items, t.n_items);
  return { ok, total, date_ok: e.date === undefined ? null : x.date === e.date };
}

type Known = { date: string | null; receipt_price_total: number | null; prices: { price: number; product_name: string | null }[] };

function scoreKnown(x: ReceiptExtraction, k: Known, details: string[]) {
  // Un prix connu est « retrouvé » s'il correspond à un montant d'article : ligne, unité, avant ou après remise.
  const amounts = new Set(
    x.items.flatMap((i) => [i.price_cents, i.paid_cents, i.unit_price_cents, Math.round(i.paid_cents / i.qty), Math.round(i.price_cents / i.qty)]),
  );
  let ok = 0;
  for (const p of k.prices) {
    if (amounts.has(cents(p.price)!)) ok++;
    else details.push(`prix connu non retrouvé : ${p.price} € (${p.product_name ?? "?"})`);
  }
  let total = k.prices.length;
  if (k.receipt_price_total != null) {
    total++;
    if (x.printed.paid_cents === cents(k.receipt_price_total)) ok++;
    else details.push(`total payé : lu ${x.printed.paid_cents}, attendu ${cents(k.receipt_price_total)}`);
  }
  if (k.date && x.date !== k.date) details.push(`date : lu ${x.date} (${x.date_raw}), attendu ${k.date}`);
  return { ok, total, date_ok: k.date ? x.date === k.date : null };
}

// ---------------------------------------------------------------------------
// Un passage sur un ticket
// ---------------------------------------------------------------------------
async function extract(t: Ticket, run: number): Promise<ReceiptExtraction> {
  const cachePath = join(CACHE, "transcripts", `${t.id}.json`);
  if (CACHED) {
    // On ré-interprète la transcription sauvée : mesure les changements d'interprétation seuls.
    const saved = JSON.parse(await readFile(cachePath, "utf8")) as ReceiptExtraction;
    const transcription: Transcription = { store: saved.store, date_raw: saved.date_raw, time_raw: saved.time_raw, lines: saved.lines };
    const r = interpret(transcription);
    const c = runChecks(r);
    return { ...saved, ...r, check_errors: c.errors, checks_skipped: c.skipped, needs_review: c.needs_review, computed: c.computed };
  }
  const img = await prepareImage(await readFile(t.image));
  const { extraction } = await parseReceipt(img);
  if (run === 0) await writeFile(cachePath, JSON.stringify(extraction, null, 1));
  return extraction;
}

async function evaluate(t: Ticket, run: number): Promise<Score> {
  const details: string[] = [];
  const truth = JSON.parse(await readFile(t.truthPath, "utf8"));
  try {
    const x = await extract(t, run);
    const s = t.kind === "expected" ? scoreExpected(x, truth, details) : scoreKnown(x, truth, details);
    details.push(...x.check_errors.map((e) => `check : ${e}`));
    return {
      id: t.id, kind: t.kind, date_ok: s.date_ok, fields_ok: s.ok, fields_total: s.total,
      errors: x.check_errors.length, needs_review: x.needs_review, attempts: x.attempts, ms: x.ms,
      signature: x.items.map((i) => `${i.raw_label}|${i.price_cents}|${i.discount_cents}`).join("\n"),
      details,
    };
  } catch (err) {
    return {
      id: t.id, kind: t.kind, date_ok: false, fields_ok: 0, fields_total: 1, errors: 1, needs_review: true,
      attempts: 0, ms: 0, signature: "ERREUR", details: [`ERREUR : ${(err as Error).message}`],
    };
  }
}

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }));
  return out;
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)} %` : "-");

async function main() {
  await mkdir(join(CACHE, "transcripts"), { recursive: true });
  const tickets = await listTickets();
  if (!tickets.length) throw new Error("Aucun ticket trouvé dans tickets/ ni tickets/openprices/");
  console.log(`${tickets.length} ticket(s), ${CACHED ? "transcriptions sauvées (sans modèle)" : `${RUNS} passage(s)`}\n`);

  const runs: Score[][] = [];
  for (let r = 0; r < (CACHED ? 1 : RUNS); r++) runs.push(await pool(tickets, CONCURRENCY, (t) => evaluate(t, r)));

  // Détail par ticket (premier passage)
  for (const s of runs[0]) {
    console.log(`${s.id.padEnd(10)} ${String(s.fields_ok).padStart(3)}/${String(s.fields_total).padEnd(3)} date:${s.date_ok === null ? "-" : s.date_ok ? "ok" : "KO"} ` +
      `erreurs:${s.errors} relecture:${s.needs_review ? "oui" : "non"} essais:${s.attempts} ${s.ms} ms`);
    for (const d of s.details) console.log(`           · ${d}`);
  }

  // Résumé, sur tous les passages
  const all = runs.flat();
  const dates = all.filter((s) => s.date_ok !== null);
  console.log("\n=== Résumé");
  console.log(`champs / prix connus justes : ${pct(all.reduce((a, s) => a + s.fields_ok, 0), all.reduce((a, s) => a + s.fields_total, 0))}`);
  console.log(`dates justes                : ${pct(dates.filter((s) => s.date_ok).length, dates.length)}`);
  console.log(`tickets sans erreur de check: ${pct(all.filter((s) => s.errors === 0).length, all.length)}`);
  console.log(`tickets à relire            : ${pct(all.filter((s) => s.needs_review).length, all.length)}`);
  console.log(`retry utilisé               : ${pct(all.filter((s) => s.attempts > 1).length, all.length)}`);
  console.log(`temps moyen (modèle)        : ${Math.round(all.reduce((a, s) => a + s.ms, 0) / all.length)} ms`);
  if (runs.length > 1) {
    const stable = tickets.filter((_, i) => runs.every((r) => r[i].signature === runs[0][i].signature)).length;
    console.log(`stabilité (${runs.length} passages)     : ${stable}/${tickets.length} tickets lus à l'identique`);
  }

  await writeFile(join(CACHE, `extract-${new Date().toISOString().replace(/[:.]/g, "-")}.json`), JSON.stringify(runs, null, 1));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
