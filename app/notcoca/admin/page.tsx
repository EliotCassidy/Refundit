// OWNER: Dev 2. NotCoca back-office (demo): list requests, refund or reject them.
import type { Metadata } from "next";
import { isAdmin } from "@/lib/notcoca/admin";
import { euros } from "@/lib/notcoca/catalog";
import { createAdminClient } from "@/lib/shared/supabase/admin";
import { DecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "Back-office service consommateurs" };
export const dynamic = "force-dynamic";

const STATUS: Record<string, { label: string; cls: string }> = {
  new: { label: "Nouvelle", cls: "bg-blue-100 text-blue-800" },
  refunded: { label: "Remboursée", cls: "bg-green-100 text-green-800" },
  rejected: { label: "Refusée", cls: "bg-red-100 text-red-800" },
};

export default async function AdminPage({ searchParams }: PageProps<"/notcoca/admin">) {
  if (!(await isAdmin())) {
    const { error } = await searchParams;
    return (
      <div className="mx-auto max-w-sm px-4 py-16">
        <h1 className="mb-4 text-2xl font-black">Back-office NotCoca</h1>
        <form method="post" action="/api/notcoca/admin/login" className="flex flex-col gap-3">
          <input name="key" type="password" required placeholder="Clé d'accès" className="rounded-lg border border-neutral-300 px-3 py-2" />
          {error && <p className="text-sm text-red-600">Clé incorrecte.</p>}
          <button className="rounded-full bg-[#1F3BFF] px-4 py-2 font-semibold text-white">Se connecter</button>
        </form>
      </div>
    );
  }

  const { data: requests } = await createAdminClient()
    .from("notcoca_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(50);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-10">
      <h1 className="text-2xl font-black">Demandes consommateurs</h1>
      {!requests?.length && <p className="text-neutral-500">Aucune demande pour l&apos;instant.</p>}
      {requests?.map((r) => (
        <details key={r.id} open={r.status === "new"} className="rounded-2xl border border-neutral-200 p-4">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2">
            <span className="font-bold">{r.ticket_number} · {r.first_name} {r.last_name}</span>
            <span className="flex items-center gap-2 text-sm text-neutral-500">
              {new Date(r.created_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS[r.status]?.cls}`}>{STATUS[r.status]?.label}</span>
            </span>
          </summary>
          <dl className="mt-4 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2">
            {[
              ["Motif", r.reason], ["Boisson", [r.drink, r.packaging, r.format].filter(Boolean).join(" · ")],
              ["A toujours la boisson", r.still_has_product], ["Quantité", r.quantity], ["DDM", r.best_before],
              ["Code de production", r.production_code], ["Point de vente", r.store], ["Date d'achat", r.purchase_date],
              ["E-mail", r.email], ["Téléphone", r.phone], ["Adresse", [r.address, r.postal_code, r.city].filter(Boolean).join(", ")],
            ].filter(([, v]) => v).map(([k, v]) => (
              <div key={String(k)} className="flex gap-2"><dt className="text-neutral-500">{k} :</dt><dd>{String(v)}</dd></div>
            ))}
          </dl>
          <p className="mt-3 whitespace-pre-wrap rounded-xl bg-neutral-50 p-3 text-sm">{r.message}</p>
          {r.status === "new" ? (
            <DecisionForm requestId={r.id} />
          ) : (
            r.status === "refunded" && (
              <p className="mt-3 text-sm text-green-800">
                Remboursé {euros(r.refund_cents ?? 0)} + dédommagement {euros(r.compensation_cents ?? 0)}
                {r.stripe_payment_id ? ` · Stripe ${r.stripe_payment_id}` : " · sans paiement Stripe"}
              </p>
            )
          )}
        </details>
      ))}
    </div>
  );
}
