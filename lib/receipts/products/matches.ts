// Cache partagé des produits confirmés par les utilisateurs : (enseigne, libellé) → EAN.
// Table product_matches, service role uniquement (API_CONTRACTS §2).
// Un produit déjà confirmé remonte en tête, mais l'utilisateur confirme toujours : jamais de validation automatique.
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
    .select("product, confirmations")
    .eq("store_chain", chainKey(chain))
    .eq("label_key", labelKey(rawLabel))
    .order("confirmations", { ascending: false })
    .limit(5);
  if (error) throw error;
  return data.flatMap((row) => {
    const p = ProductSchema.safeParse(row.product);
    return p.success ? [{ product: p.data, confirmations: row.confirmations }] : [];
  });
}

export async function recordConfirmation(chain: string | null, rawLabel: string, product: Product): Promise<void> {
  const db = createAdminClient();
  const key = { store_chain: chainKey(chain), label_key: labelKey(rawLabel), ean: product.ean };
  const { data: existing, error } = await db.from("product_matches").select("id, confirmations").match(key).maybeSingle();
  if (error) throw error;
  const fields = { raw_label: rawLabel, product: product as unknown as Json, last_confirmed_at: new Date().toISOString() };
  const res = existing
    ? await db.from("product_matches").update({ ...fields, confirmations: existing.confirmations + 1 }).eq("id", existing.id)
    : await db.from("product_matches").insert({ ...key, ...fields });
  if (res.error) throw res.error;
}
