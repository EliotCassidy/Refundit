// OWNER: Dev 1. Crée ou met à jour le profil de l'utilisateur connecté (table profiles).
// Écrit avec le client utilisateur (RLS "own profile") : impossible d'écrire la ligne d'un autre.
import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError } from "@/lib/shared/http";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import { isValidIban, normalizeIban } from "@/lib/shared/iban";

export const ProfileFormSchema = z.object({
  first_name: z.string().trim().min(1, "Le prénom est requis.").max(100),
  last_name: z.string().trim().min(1, "Le nom est requis.").max(100),
  phone: z
    .string()
    .trim()
    .min(1, "Le numéro de téléphone est requis.")
    .regex(/^[+]?[0-9][0-9 ().\-]{5,19}$/, "Numéro de téléphone invalide.")
    .max(20),
  address_line1: z.string().trim().min(1, "L'adresse est requise.").max(120),
  address_line2: z.string().trim().max(120).optional().transform((v) => (v || null)),
  postal_code: z.string().trim().min(1, "Le code postal est requis.").max(10),
  city: z.string().trim().min(1, "La ville est requise.").max(100),
  country: z.string().trim().min(1, "Le pays est requis.").max(100).default("FR"),
  // Optional (onboarding): only written when sent, so the profile page keeps working without them.
  civility: z.enum(["madame", "monsieur", "autre"]).optional(),
  iban: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? normalizeIban(v) : undefined))
    .refine((v) => v === undefined || isValidIban(v), "IBAN invalide : vérifiez les chiffres."),
});

export type ProfileForm = z.infer<typeof ProfileFormSchema>;

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) return apiError(401, "unauthenticated", "Connexion requise.");

  const parsed = ProfileFormSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return apiError(400, "invalid_profile", parsed.error.issues.map((i) => i.message).join(" "));
  }
  const data = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    first_name: data.first_name,
    last_name: data.last_name,
    phone: data.phone,
    address_line1: data.address_line1,
    address_line2: data.address_line2,
    postal_code: data.postal_code,
    city: data.city,
    country: data.country,
    ...(data.civility ? { civility: data.civility } : {}),
    ...(data.iban ? { iban: data.iban } : {}),
  });
  if (error) {
    return apiError(500, "profile_error", "Impossible d'enregistrer votre profil. Réessayez.");
  }
  return Response.json({ profile: { id: user.id, ...data, iban: data.iban ? "set" : undefined } }, { status: 200 });
}
