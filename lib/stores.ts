// OWNER: Dev 2 (shared UI data). Static registry of the main French grocery chains and their logos
// (files in public/stores/: `icon` = square mark for avatars, `wordmark` = full logo for headers).
// Logos come from the chains' own site icons and Wikimedia Commons; they only identify the store printed
// on the user's receipt. No DB table: the list is small, fixed and needs no migration.

export type Store = {
  id: string;
  name: string; // display name
  color: string; // brand color, used for the monogram fallback
  icon?: string;
  wordmark?: string;
  match: RegExp; // tested against the normalized chain / store name read on the receipt
};

const STORES: Store[] = [
  // Most specific first.
  { id: "carrefour-market", name: "Carrefour Market", color: "#1E5BC6", icon: "carrefour-icon.png", match: /carrefour\s*market/ },
  { id: "carrefour-city", name: "Carrefour City", color: "#1E5BC6", icon: "carrefour-icon.png", match: /carrefour\s*city/ },
  { id: "carrefour-express", name: "Carrefour Express", color: "#1E5BC6", icon: "carrefour-icon.png", match: /carrefour\s*express/ },
  { id: "carrefour", name: "Carrefour", color: "#1E5BC6", icon: "carrefour-icon.png", match: /carrefour/ },
  { id: "leclerc", name: "E.Leclerc", color: "#0066B3", wordmark: "leclerc.svg", match: /leclerc/ },
  { id: "intermarche", name: "Intermarché", color: "#E2001A", wordmark: "intermarche.svg", match: /intermarche|itm\b/ },
  { id: "netto", name: "Netto", color: "#E30613", wordmark: "netto.svg", match: /netto/ },
  { id: "auchan", name: "Auchan", color: "#E2001A", icon: "auchan-icon.png", wordmark: "auchan.svg", match: /auchan/ },
  { id: "hyper-u", name: "Hyper U", color: "#E2001A", icon: "systeme-u-icon.png", match: /hyper\s*u\b/ },
  { id: "super-u", name: "Super U", color: "#E2001A", icon: "systeme-u-icon.png", match: /super\s*u\b/ },
  { id: "u-express", name: "U Express", color: "#E2001A", icon: "systeme-u-icon.png", match: /u\s*express/ },
  { id: "systeme-u", name: "Magasins U", color: "#E2001A", icon: "systeme-u-icon.png", match: /systeme\s*u|magasins?\s*u\b|^u$/ },
  { id: "lidl", name: "Lidl", color: "#0050AA", icon: "lidl-icon.svg", match: /lidl/ },
  { id: "aldi", name: "Aldi", color: "#00005F", icon: "aldi-icon.svg", match: /aldi/ },
  { id: "monoprix", name: "Monoprix", color: "#E3001B", icon: "monoprix-icon.png", wordmark: "monoprix.svg", match: /monoprix|monop/ },
  { id: "franprix", name: "Franprix", color: "#F36C21", icon: "franprix-icon.png", wordmark: "franprix.svg", match: /franprix/ },
  { id: "geant", name: "Géant Casino", color: "#E2231A", wordmark: "geant.jpg", match: /geant/ },
  { id: "casino", name: "Casino", color: "#E30613", wordmark: "casino.svg", match: /casino/ },
  { id: "leader-price", name: "Leader Price", color: "#2BB37F", icon: "leader-price-icon.png", match: /leader\s*price/ },
  { id: "cora", name: "Cora", color: "#E2001A", icon: "cora-icon.svg", match: /\bcora\b/ },
  { id: "biocoop", name: "Biocoop", color: "#6FAE2D", match: /biocoop/ },
  { id: "naturalia", name: "Naturalia", color: "#C4381C", wordmark: "naturalia.svg", match: /naturalia/ },
  { id: "bio-c-bon", name: "Bio c' Bon", color: "#1F6E3A", icon: "bio-c-bon-icon.svg", match: /bio\s*c.?\s*bon/ },
  { id: "la-vie-claire", name: "La Vie Claire", color: "#4C8C6B", icon: "la-vie-claire-icon.png", match: /vie\s*claire/ },
  { id: "picard", name: "Picard", color: "#0A1F8F", icon: "picard-icon.png", match: /picard/ },
  { id: "grand-frais", name: "Grand Frais", color: "#7AB51D", icon: "grand-frais-icon.png", match: /grand\s*frais/ },
  { id: "spar", name: "Spar", color: "#E2001A", wordmark: "spar.svg", match: /\bspar\b/ },
  { id: "colruyt", name: "Colruyt", color: "#F28C00", icon: "colruyt-icon.png", wordmark: "colruyt.svg", match: /colruyt/ },
  { id: "match", name: "Supermarchés Match", color: "#E2001A", match: /\bmatch\b/ },
  { id: "vival", name: "Vival", color: "#E30613", match: /vival/ },
  { id: "g20", name: "G20", color: "#E30613", match: /\bg\s*20\b/ },
  // Fictional demo store (the NotCoca demo receipts). Original mark, not a real chain.
  { id: "notmarket", name: "NotMarket", color: "#14532D", icon: "notmarket-icon.svg", match: /notmarket|not\s*market/ },
];

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ").trim();

/** Finds the chain from what the receipt printed (chain first, then store name). */
export function findStore(...names: (string | null | undefined)[]): Store | null {
  for (const n of names) {
    if (!n) continue;
    const s = norm(n);
    const hit = STORES.find((st) => st.match.test(s));
    if (hit) return hit;
  }
  return null;
}

export const storeAsset = (file: string) => `/stores/${file}`;
