// OWNER: Dev 2. Complaint text, built ONLY from user-provided facts (CLAUDE.md rule 1).
// Deterministic template on purpose: no LLM, so it can never invent a detail.
// Pure module (no server-only) so scripts can import it.
import type { IssueType } from "@/lib/shared/types";

export type ComplaintFacts = {
  firstName: string;
  lastName: string;
  productName: string;
  brandName: string | null;
  storeName: string | null;
  purchasedAt: string | null; // ISO
  totalPriceCents: number | null;
  issueType: IssueType;
  issueDescription: string | null;
  hasReceiptAttachment: boolean; // kept for callers; the text no longer depends on it
};

const ISSUE_SENTENCES: Record<IssueType, string> = {
  damaged: "Le produit était abîmé (écrasé ou endommagé).",
  missing_quantity: "La quantité contenue ne correspondait pas à celle indiquée sur l'emballage.",
  expired: "La date de consommation du produit était dépassée.",
  quality: "Le produit présentait un goût ou une texture anormale.",
  foreign_object: "J'ai trouvé un corps étranger dans le produit.",
  flat_drink: "La boisson n'était pas gazeuse alors qu'elle devait l'être.",
  other: "J'ai rencontré un problème avec ce produit.",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" });

const formatPrice = (cents: number) =>
  (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function buildComplaintText(f: ComplaintFacts): string {
  const product = f.brandName && !f.productName.toLowerCase().includes(f.brandName.toLowerCase())
    ? `« ${f.productName} » (${f.brandName})`
    : `« ${f.productName} »`;

  const purchase = [
    `J'ai acheté le produit ${product}`,
    f.purchasedAt ? ` le ${formatDate(f.purchasedAt)}` : "",
    f.storeName ? ` au magasin ${f.storeName}` : "",
    f.totalPriceCents != null ? `, pour un montant de ${formatPrice(f.totalPriceCents)}` : "",
    ".",
  ].join("");

  const lines = [
    "Bonjour,",
    "",
    purchase,
    ISSUE_SENTENCES[f.issueType],
  ];
  const description = f.issueDescription?.trim();
  if (description) lines.push(`Précisions : ${description}`);
  lines.push(
    "",
    // Neutral on purpose: many forms have no upload field, so "en pièce jointe" could be false.
    "Je tiens mon ticket de caisse à votre disposition comme preuve d'achat.",
    "Je vous remercie de bien vouloir me proposer un remboursement ou un geste commercial.",
    "",
    "Cordialement,",
    `${f.firstName} ${f.lastName}`,
  );
  return lines.join("\n");
}
