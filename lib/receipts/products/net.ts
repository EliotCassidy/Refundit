// Réseau pour l'identification produit : cache de TOUS les appels (les « pas trouvé » compris),
// débit limité par site, quelques essais espacés sur 429 / 5xx / délai dépassé, User-Agent du projet.
// Cache disque en local (.cache/http) ; sur Vercel, cache mémoire de l'instance (disque non persistant).
// Linkup n'est PAS appelé ici : il est payant et ne doit jamais être relancé automatiquement.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export const USER_AGENT = "Refundit/0.1 (hackathon H Company x 42AI; +https://github.com/EliotCassidy/Refundit)";

// Intervalle minimal entre deux appels au même site.
// Doc OFF (openfoodfacts.github.io/openfoodfacts-server/api) : 10 recherches/min, 15 lectures produit/min.
// Search-a-licious et Open Prices : pas de limite publiée ; 0,5 s et 0,2 s ont tenu sans 429 sur des centaines
// d'appels dans le prototype Python (~/Documents/hackaton/resolve.py).
const MIN_INTERVAL_MS: Record<string, number> = {
  "world.openbeautyfacts.org": 6_000, // supposé identique à OFF (non documenté pour OBF)
  "world.openfoodfacts.org": 4_000,
  "search.openfoodfacts.org": 500,
  "prices.openfoodfacts.org": 200,
};

const ON_VERCEL = Boolean(process.env.VERCEL);
const CACHE_DIR = join(process.cwd(), ".cache", "http");
const memory = new Map<string, unknown>();
const nextSlot = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cacheGet(key: string): Promise<{ hit: boolean; value?: unknown }> {
  if (memory.has(key)) return { hit: true, value: memory.get(key) };
  if (ON_VERCEL) return { hit: false };
  try {
    const value = JSON.parse(await readFile(join(CACHE_DIR, `${key}.json`), "utf8")).value;
    memory.set(key, value);
    return { hit: true, value };
  } catch {
    return { hit: false };
  }
}

async function cacheSet(key: string, value: unknown) {
  memory.set(key, value);
  if (ON_VERCEL) return;
  await mkdir(CACHE_DIR, { recursive: true });
  await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify({ value }));
}

/** Met en cache le résultat d'un calcul coûteux (ex. un appel LLM), par clé. Les erreurs ne sont pas mises en cache. */
export async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
  const k = createHash("sha1").update(key).digest("hex");
  const hit = await cacheGet(k);
  if (hit.hit) return hit.value as T;
  const value = await compute();
  await cacheSet(k, value);
  return value;
}

/** Attend son tour pour ce site (les appels simultanés sont mis en file). */
async function throttle(host: string) {
  const interval = MIN_INTERVAL_MS[host] ?? 1_000;
  const now = Date.now();
  const slot = Math.max(now, nextSlot.get(host) ?? 0);
  nextSlot.set(host, slot + interval);
  if (slot > now) await sleep(slot - now);
}

/**
 * GET JSON avec cache. Renvoie null si la ressource n'existe pas (404), et le met aussi en cache.
 * Lève une erreur après `retries` essais ratés (429, 5xx, délai dépassé).
 */
export async function getJson<T>(url: string, opts: { retries?: number; timeoutMs?: number } = {}): Promise<T | null> {
  const key = createHash("sha1").update(url).digest("hex");
  const cached = await cacheGet(key);
  if (cached.hit) return cached.value as T | null;

  const host = new URL(url).host;
  const retries = opts.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    await throttle(host);
    let retryable = false;
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
        signal: AbortSignal.timeout(opts.timeoutMs ?? 10_000),
      });
      if (res.ok) {
        const value = (await res.json()) as T;
        await cacheSet(key, value);
        return value;
      }
      if (res.status === 404) {
        await cacheSet(key, null);
        return null;
      }
      retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= retries) throw new Error(`HTTP ${res.status} ${url}`);
    } catch (err) {
      const timeout = err instanceof Error && (err.name === "TimeoutError" || err.message.includes("fetch failed"));
      if (!(retryable || timeout) || attempt >= retries) throw err;
    }
    await sleep(1_000 * 2 ** attempt); // 1 s, 2 s, …
  }
}
