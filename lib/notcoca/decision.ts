// OWNER: Dev 2. NotCoca's decision on a request: refund (+ compensation) or reject, then an email
// to the customer — like a real brand. For Refundit claims, that address is the claim's Gmail plus
// address, so Refundit's inbox poller picks the answer up and classifies it.
import "server-only";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { euros } from "./catalog";
import { payRefund } from "./payout";

export type Decision =
  | { kind: "refund"; refundCents: number; compensationCents: number }
  | { kind: "reject"; reason: string };

export async function decide(requestId: string, decision: Decision) {
  const db = createAdminClient();
  const { data: req, error } = await db.from("notcoca_requests").select("*").eq("id", requestId).single();
  if (error) throw error;
  if (req.status !== "new") throw new Error(`Request already ${req.status}`);

  const who = `${req.civility && req.civility !== "Autre" ? `${req.civility} ` : ""}${req.last_name}`;
  const product = [req.drink, req.format].filter(Boolean).join(" ") || "votre produit";
  let payment: { id: string } | null = null;
  let text: string;
  let subject: string;

  if (decision.kind === "refund") {
    const total = decision.refundCents + decision.compensationCents;
    payment = await payRefund({ customerEmail: req.email, amountCents: total, ticketNumber: req.ticket_number });
    subject = `Votre demande ${req.ticket_number} – remboursement accordé`;
    text = [
      `Bonjour ${who},`,
      "",
      `Nous avons bien reçu votre demande n° ${req.ticket_number} concernant ${product} et nous sommes sincèrement désolés pour ce désagrément.`,
      "",
      `Nous vous remboursons le prix d'achat (${euros(decision.refundCents)}) et vous offrons un dédommagement de ${euros(decision.compensationCents)}, soit ${euros(total)} au total.`,
      payment
        ? `Le paiement a été effectué (référence : ${payment.id}).`
        : "Le virement sera effectué sous 5 jours ouvrés.",
      "",
      "Bien cordialement,",
      "Le Service Consommateurs NotCoca",
    ].join("\n");
  } else {
    subject = `Votre demande ${req.ticket_number}`;
    text = [
      `Bonjour ${who},`,
      "",
      `Nous avons bien reçu votre demande n° ${req.ticket_number} concernant ${product}.`,
      `Après examen, nous ne sommes malheureusement pas en mesure d'y donner une suite favorable : ${decision.reason}`,
      "",
      "Bien cordialement,",
      "Le Service Consommateurs NotCoca",
    ].join("\n");
  }

  await sendEmail({ to: req.email, fromName: "Service Consommateurs NotCoca", alias: null, subject, text });

  await db
    .from("notcoca_requests")
    .update({
      status: decision.kind === "refund" ? "refunded" : "rejected",
      refund_cents: decision.kind === "refund" ? decision.refundCents : null,
      compensation_cents: decision.kind === "refund" ? decision.compensationCents : null,
      stripe_payment_id: payment?.id ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  return { paymentId: payment?.id ?? null };
}
