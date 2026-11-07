// OWNER: Dev 2. POST /api/notcoca/requests — NotCoca's public contact form (fictional demo brand).
import { randomInt } from "node:crypto";
import { apiError } from "@/lib/shared/http";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { newTicketNumber, NotCocaRequestSchema } from "@/lib/notcoca/catalog";

export async function POST(request: Request) {
  const parsed = NotCocaRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return apiError(400, "invalid_form", first ? `${first.path.join(".")}: ${first.message}` : "Formulaire invalide");
  }
  const d = parsed.data;
  const ticketNumber = newTicketNumber(randomInt(0, 1_000_000));

  const { error } = await createAdminClient().from("notcoca_requests").insert({
    ticket_number: ticketNumber,
    reason: d.reason,
    still_has_product: d.still_has_product ?? null,
    drink: d.drink ?? null,
    packaging: d.packaging ?? null,
    format: d.format ?? null,
    quantity: d.quantity ?? null,
    best_before: d.best_before,
    production_code: d.production_code,
    store: d.store,
    purchase_date: d.purchase_date ?? null,
    message: d.message,
    civility: d.civility ?? null,
    last_name: d.last_name,
    first_name: d.first_name,
    address: d.address,
    postal_code: d.postal_code,
    city: d.city,
    phone: d.phone,
    email: d.email.toLowerCase(),
  });
  if (error) return apiError(500, "db_error", error.message);
  return Response.json({ ticketNumber }, { status: 201 });
}
