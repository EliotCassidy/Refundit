// OWNER: Dev 2. NotCoca — FICTIONAL demo soda brand (not affiliated with any real company).
// The contact form mirrors the structure of a real French soda consumer-service form
// (spike 2026-11-07), so the H agent faces a realistic multi-step flow.
import { z } from "zod";

export const BRAND = "NotCoca";

export const REASONS = [
  "J'ai un problème avec une boisson que j'ai achetée",
  "J'ai une question sur nos produits",
  "Autre demande",
] as const;
export const PROBLEM_REASON = REASONS[0];

export const DRINKS = ["NotCoca Original", "NotCoca Zéro", "NotCoca Cherry", "NotCoca Citron"] as const;
export const PACKAGINGS = ["Canette", "Bouteille plastique", "Bouteille verre"] as const;
export const FORMATS = ["33 cl", "50 cl", "1 L", "1,25 L", "1,5 L", "1,75 L", "2 L"] as const;
export const CIVILITIES = ["Madame", "Monsieur", "Autre"] as const;
export const YES_NO = ["Oui", "Non"] as const;

const optional = z.string().trim().max(200).optional().transform((v) => v || null);

export const NotCocaRequestSchema = z
  .object({
    reason: z.enum(REASONS),
    still_has_product: z.enum(YES_NO).optional(),
    drink: z.enum(DRINKS).optional(),
    packaging: z.enum(PACKAGINGS).optional(),
    format: z.enum(FORMATS).optional(),
    quantity: z.coerce.number().int().min(1).max(99).optional(),
    best_before: optional,
    production_code: optional,
    store: optional,
    purchase_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    message: z.string().trim().min(10).max(4000),
    civility: z.enum(CIVILITIES),
    last_name: z.string().trim().min(1).max(100),
    first_name: z.string().trim().min(1).max(100),
    address: z.string().trim().min(1).max(200),
    postal_code: z.string().trim().regex(/^\d{5}$/),
    city: z.string().trim().min(1).max(100),
    phone: optional,
    email: z.email(),
    email_confirm: z.email(),
    terms: z.literal(true),
  })
  .refine((d) => d.email.toLowerCase() === d.email_confirm.toLowerCase(), { message: "Les adresses e-mail ne correspondent pas", path: ["email_confirm"] })
  .refine((d) => d.reason !== PROBLEM_REASON || (d.still_has_product && d.drink && d.packaging && d.format && d.purchase_date), {
    message: "Merci de renseigner les informations sur la boisson",
    path: ["drink"],
  });
export type NotCocaRequestInput = z.infer<typeof NotCocaRequestSchema>;

export function newTicketNumber(random6: number): string {
  return `NC-${String(random6).padStart(6, "0")}`;
}

export const euros = (cents: number) => (cents / 100).toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
