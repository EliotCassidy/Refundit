// Cache partagé des produits confirmés par les utilisateurs : (enseigne, libellé) → EAN.
// Table product_matches, service role uniquement (API_CONTRACTS §2).
// Seuls les choix EXPLICITES d'un utilisateur comptent (manual_confirmations) : une validation automatique n'écrit
// jamais ici, donc le raccourci « déjà connu » ne peut pas s'auto-alimenter ni figer une erreur.
import "server-only";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import type { Json } from "@/lib/shared/database.types";
import { ProductSchema, type Product } from "@/lib/shared/types";
import { normalize } from "../text";

export const chainKey = (chain: string | null | undefined) => normalize(chain ?? "");
export const labelKey = (rawLabel: string) => normalize(rawLabel);

export type ConfirmedMatch = { product: Product; confirmations: number };

export async function findConfirmedMatches(chain: string | null, rawLabel: string): Promise<ConfirmedMatch[]> {
  const { data, error } = await createAdminClient()
    .from("product_matches")
    .select("product, manual_confirmations")
    .eq("store_chain", chainKey(chain))
    .eq("label_key", labelKey(rawLabel))
    .gte("manual_confirmations", 1)
    .order("manual_confirmations", { ascending: false })
    .order("last_confirmed_at", { ascending: false }) // à égalité, le choix le plus récent passe devant
    .limit(5);
  if (error) throw error;
  return data.flatMap((row) => {
    const p = ProductSchema.safeParse(row.product);
    return p.success ? [{ product: p.data, confirmations: row.manual_confirmations }] : [];
  });
}

/** À appeler seulement pour un choix explicite de l'utilisateur (jamais pour une validation automatique). */
export async function recordConfirmation(chain: string | null, rawLabel: string, product: Product): Promise<void> {
  const db = createAdminClient();
  const key = { store_chain: chainKey(chain), label_key: labelKey(rawLabel), ean: product.ean };
  const { data: existing, error } = await db
    .from("product_matches").select("id, confirmations, manual_confirmations").match(key).maybeSingle();
  if (error) throw error;
  const fields = { raw_label: rawLabel, product: product as unknown as Json, last_confirmed_at: new Date().toISOString() };
  const res = existing
    ? await db.from("product_matches")
        .update({ ...fields, confirmations: existing.confirmations + 1, manual_confirmations: existing.manual_confirmations + 1 })
        .eq("id", existing.id)
    : await db.from("product_matches").insert({ ...key, ...fields, manual_confirmations: 1 });
  if (res.error) throw res.error;
}

/**
 * L'utilisateur a corrigé ce produit (validé avant, souvent automatiquement) : un choix manuel de moins pour lui sur ce
 * libellé. À 0 il ne sort plus du raccourci « déjà connu » : une erreur ne peut pas revenir en vert à chaque ticket.
 */
export async function forgetConfirmation(chain: string | null, rawLabel: string, ean: string): Promise<void> {
  const db = createAdminClient();
  const key = { store_chain: chainKey(chain), label_key: labelKey(rawLabel), ean };
  const { data: row, error } = await db.from("product_matches").select("id, manual_confirmations").match(key).maybeSingle();
  if (error) throw error;
  if (!row || row.manual_confirmations <= 0) return;
  const res = await db.from("product_matches").update({ manual_confirmations: row.manual_confirmations - 1 }).eq("id", row.id);
  if (res.error) throw res.error;
}
