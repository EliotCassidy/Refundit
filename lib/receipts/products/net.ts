// Réseau pour l'identification produit : cache des VRAIES réponses (200, et 404 = « pas trouvé »), débit limité par
// site, quelques essais espacés sur 429 / 5xx / délai dépassé (en respectant Retry-After), User-Agent du projet.
// Cache à 3 niveaux : mémoire → disque en local (.cache/http) → Supabase `lookup_cache` sur Vercel (pas de disque,
// et partagé entre instances). Jamais d'erreur en cache ; les réponses vides expirent après 24 h, pour qu'une
// recherche ratée (ex. 15h58) ne soit pas figée.
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Json } from "@/lib/shared/database.types";

export const USER_AGENT = "Refundit/0.1 (hackathon H Company x 42AI; +https://github.com/EliotCassidy/Refundit)";

// Intervalle minimal entre deux appels au même site (par instance).
// Doc OFF (openfoodfacts.github.io/openfoodfacts-server/api) : 10 recherches/min (/cgi/search.pl, /api/v2/search),
// 15 lectures produit/min. Search-a-licious et Open Prices : pas de limite publiée ; 0,5 s et 0,2 s ont tenu sans 429
// sur des centaines d'appels dans le prototype Python (~/Documents/hackaton/resolve.py).
const MIN_INTERVAL_MS: Record<string, number> = {
  "world.openbeautyfacts.org": 6_000, // supposé identique à OFF (non documenté pour OBF)
  "world.openfoodfacts.org": 4_000,
  "search.openfoodfacts.org": 500,
  "prices.openfoodfacts.org": 200,
};

const ON_VERCEL = Boolean(process.env.VERCEL);
const CACHE_DIR = join(process.cwd(), ".cache", "http");
const EMPTY_TTL_MS = 24 * 3600_000; // une réponse vide est retentée au bout de 24 h

type Entry = { value: unknown; empty: boolean; at: number };
const memory = new Map<string, Entry>();
const nextSlot = new Map<string, number>();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Client Supabase admin chargé seulement sur Vercel (les tests sans serveur n'ont pas le droit d'importer « server-only »).
const admin = async () => (await import("@/lib/shared/supabase/admin")).createAdminClient();

/** Réponse « vide » : null (404), liste vide, ou objet dont la liste de résultats (hits/products/items/results) est vide. */
export function isEmptyResult(v: unknown): boolean {
  if (v == null) return true;
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") {
    for (const k of ["hits", "products", "items", "results"]) {
      const list = (v as Record<string, unknown>)[k];
      if (Array.isArray(list)) return list.length === 0;
    }
  }
  return false;
}

/** Une entrée est utilisable si elle n'est pas vide, ou si elle est vide depuis moins de 24 h. */
export const isFresh = (e: { empty: boolean; at: number }, now = Date.now()) => !e.empty || now - e.at < EMPTY_TTL_MS;

async function cacheGet(key: string): Promise<{ hit: boolean; value?: unknown }> {
  const m = memory.get(key);
  if (m && isFresh(m)) return { hit: true, value: m.value };

  if (!ON_VERCEL) {
    try {
      const saved = JSON.parse(await readFile(join(CACHE_DIR, `${key}.json`), "utf8")) as Partial<Entry>;
      // Anciens fichiers { value } sans date : gardés s'ils ne sont pas vides, retentés sinon.
      const entry: Entry = { value: saved.value, empty: saved.empty ?? isEmptyResult(saved.value), at: saved.at ?? 0 };
      if (isFresh(entry)) {
        memory.set(key, entry);
        return { hit: true, value: entry.value };
      }
    } catch {
      // pas en cache
    }
    return { hit: false };
  }

  try {
    const { data } = await (await admin()).from("lookup_cache").select("value, empty, created_at").eq("key", key).maybeSingle();
    if (data) {
      const entry: Entry = { value: data.value, empty: data.empty, at: Date.parse(data.created_at) };
      if (isFresh(entry)) {
        memory.set(key, entry);
        return { hit: true, value: entry.value };
      }
    }
  } catch (err) {
    console.error("[lookup_cache] lecture", err); // le cache ne doit jamais bloquer une recherche
  }
  return { hit: false };
}

async function cacheSet(key: string, value: unknown) {
  const entry: Entry = { value, empty: isEmptyResult(value), at: Date.now() };
  memory.set(key, entry);
  if (!ON_VERCEL) {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(join(CACHE_DIR, `${key}.json`), JSON.stringify(entry));
    return;
  }
  // upsert : deux instances peuvent écrire la même clé en même temps
  const { error } = await (await admin())
    .from("lookup_cache")
    .upsert({ key, value: value as Json, empty: entry.empty, created_at: new Date(entry.at).toISOString() }, { onConflict: "key" });
  if (error) console.error("[lookup_cache] écriture", error.message);
}

/** Met en cache le résultat d'un calcul coûteux (ex. un appel LLM), par clé. Une erreur (exception) n'est jamais mise en cache. */
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
 * GET JSON avec cache. Renvoie null si la ressource n'existe pas (404), et le met aussi en cache (24 h).
 * Sur 429 / 5xx / délai dépassé : 2 réessais, après le Retry-After du serveur (10 s max) sinon 2 s puis 5 s.
 * Lève ensuite une erreur `HTTP <code> <url>` (loguée par l'appelant), qui n'est jamais mise en cache.
 */
export async function getJson<T>(url: string, opts: { retries?: number; timeoutMs?: number } = {}): Promise<T | null> {
  const key = createHash("sha1").update(url).digest("hex");
  const hit = await cacheGet(key);
  if (hit.hit) return hit.value as T | null;

  const host = new URL(url).host;
  const retries = opts.retries ?? 2;
  for (let attempt = 0; ; attempt++) {
    await throttle(host);
    let retryable = false;
    let wait = [2_000, 5_000][attempt] ?? 5_000;
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
      const retryAfter = Number(res.headers.get("retry-after"));
      if (retryAfter > 0) wait = Math.min(retryAfter, 10) * 1000;
      if (!retryable || attempt >= retries) throw new Error(`HTTP ${res.status} ${url}`);
    } catch (err) {
      const timeout = err instanceof Error && (err.name === "TimeoutError" || err.message.includes("fetch failed"));
      if (!(retryable || timeout) || attempt >= retries) throw err;
    }
    await sleep(wait);
  }
}
