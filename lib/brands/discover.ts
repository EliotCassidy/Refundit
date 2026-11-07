// OWNER: Dev 2. Linkup lookup of a brand's French customer-service contact form + email.
// API verified against docs.linkup.so (POST /v1/search, outputType "structured",
// structuredOutputSchema as a JSON string, includeSources → { data, sources }).
//
// Anti-hallucination: a URL is kept only if it is (or shares a host with) a returned source,
// and an email only if it appears verbatim in a source's content/snippet or URL.
import "server-only";
import { z } from "zod";

const LINKUP_URL = "https://api.linkup.so/v1/search";

const ANSWER_SCHEMA = {
  type: "object",
  properties: {
    contact_form_url: {
      type: ["string", "null"],
      description: "URL of the brand's official French customer-service web form for product complaints, or null",
    },
    support_email: {
      type: ["string", "null"],
      description: "Customer-service / consumer-service email address for France, or null if none is published",
    },
  },
  required: ["contact_form_url", "support_email"],
} as const;

const ResponseSchema = z.object({
  data: z.object({
    contact_form_url: z.string().nullable().optional(),
    support_email: z.string().nullable().optional(),
  }),
  sources: z
    .array(z.object({ url: z.string(), name: z.string().optional(), content: z.string().optional(), snippet: z.string().optional() }))
    .default([]),
});

export type DiscoveredContact = {
  contactUrl: string | null;
  contactEmail: string | null;
  sources: string[];
};

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function search(brandName: string, depth: "standard" | "deep") {
  const res = await fetch(LINKUP_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.LINKUP_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      q: `Service consommateurs de la marque ${brandName} en France : formulaire de contact officiel pour une réclamation sur un produit, et adresse e-mail du service client.`,
      depth,
      outputType: "structured",
      structuredOutputSchema: JSON.stringify(ANSWER_SCHEMA),
      includeSources: true,
    }),
    signal: AbortSignal.timeout(depth === "deep" ? 40_000 : 15_000),
  });
  if (!res.ok) throw new Error(`Linkup ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return ResponseSchema.parse(await res.json());
}

function verify(r: z.infer<typeof ResponseSchema>): DiscoveredContact {
  const sourceUrls = r.sources.map((s) => s.url);
  const sourceHosts = new Set(sourceUrls.map(hostOf).filter(Boolean));
  const corpus = r.sources.map((s) => `${s.url} ${s.content ?? ""} ${s.snippet ?? ""}`).join("\n").toLowerCase();

  let contactUrl = r.data.contact_form_url?.trim() || null;
  if (contactUrl) {
    const host = hostOf(contactUrl);
    const ok = contactUrl.startsWith("https://") && host && (sourceUrls.includes(contactUrl) || sourceHosts.has(host));
    if (!ok) contactUrl = null;
  }

  let contactEmail = r.data.support_email?.trim().toLowerCase() || null;
  if (contactEmail && !(/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(contactEmail) && corpus.includes(contactEmail))) {
    contactEmail = null;
  }

  return { contactUrl, contactEmail, sources: sourceUrls.slice(0, 10) };
}

/** Standard search first (1–3 s); deep search (≤30 s) only if nothing usable was found. */
export async function discoverBrandContact(brandName: string): Promise<DiscoveredContact> {
  if (!process.env.LINKUP_API_KEY) return { contactUrl: null, contactEmail: null, sources: [] };
  const first = verify(await search(brandName, "standard"));
  if (first.contactUrl || first.contactEmail) return first;
  return verify(await search(brandName, "deep"));
}
