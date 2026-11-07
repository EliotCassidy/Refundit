// Main dashboard (home): money received, money pending, what needs the user, every claim.
import Link from "next/link";
import { redirect } from "next/navigation";
import { Candy, Money, StripeBadge } from "@/components/ui/brand";
import { STATUS_GROUP } from "@/components/ui/status";
import { createClient, getUser } from "@/lib/shared/supabase/server";
import { AutoRefresh } from "./claims/auto-refresh";
import { InboxPoller } from "./claims/inbox-poller";
import { ClaimsBoard, type BoardClaim } from "./dashboard/claims-board";

export default async function DashboardPage() {
  const user = await getUser();
  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("first_name").eq("id", user!.id).maybeSingle();
  if (!profile) redirect("/onboarding");

  const { data } = await supabase
    .from("claims")
    .select("id, status, issue_type, dry_run, missing_fields, refund_cents, created_at, updated_at, line_items(product_name, raw_label, total_price_cents), brands(name), receipts(store_name)")
    .order("updated_at", { ascending: false });

  const claims: BoardClaim[] = (data ?? []).map((c) => ({
    id: c.id,
    status: c.status,
    issueType: c.issue_type,
    dryRun: c.dry_run,
    missingFields: c.missing_fields,
    refundCents: c.refund_cents,
    stakeCents: c.line_items?.total_price_cents ?? 0,
    product: c.line_items?.product_name || c.line_items?.raw_label || "Produit",
    brand: c.brands?.name ?? null,
    store: c.receipts?.store_name ?? null,
    updatedAt: c.updated_at,
  }));

  const received = claims.reduce((sum, c) => sum + (c.refundCents ?? 0), 0);
  const refundedCount = claims.filter((c) => c.refundCents != null).length;
  const open = claims.filter((c) => STATUS_GROUP[c.status] === "progress" || STATUS_GROUP[c.status] === "action");
  const pending = open.reduce((sum, c) => sum + c.stakeCents, 0);
  const needsYou = claims.filter((c) => STATUS_GROUP[c.status] === "action");
  const submitting = claims.filter((c) => c.status === "submitting").map((c) => c.id);

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-muted">Bonjour {profile.first_name}</p>
          <h1 className="title-tight text-[34px] font-bold md:text-[44px]">Tes remboursements</h1>
        </div>
      </header>

      {/* Money */}
      <section className="grid gap-3 md:grid-cols-3 md:gap-4">
        <div className="relative overflow-hidden rounded-[28px] bg-[#111714] p-5 text-[#F2F4F1] shadow-[0_18px_40px_rgba(17,23,20,0.18)] md:col-span-2 md:p-7">
          <div className="pointer-events-none absolute -right-16 -top-20 size-64 rounded-full bg-[#22C55E]/20 blur-3xl" aria-hidden />
          <div className="relative flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <span className="overline text-[#A4ADA7]">Récupéré au total</span>
              <StripeBadge className="text-[#F2F4F1]" />
            </div>
            <Money cents={received} className="text-[44px] leading-none text-[#4ADE80] md:text-[56px]" />
            <p className="text-sm text-[#A4ADA7]">
              {refundedCount === 0
                ? "Ton premier remboursement arrivera ici, versé sur ton compte."
                : `${refundedCount} remboursement${refundedCount > 1 ? "s" : ""} reçu${refundedCount > 1 ? "s" : ""}, versé${refundedCount > 1 ? "s" : ""} directement sur ton compte.`}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-1 md:gap-4">
          <div className="flex flex-col gap-2 rounded-[24px] border border-line bg-raised p-4 md:p-5">
            <span className="overline text-muted">En attente</span>
            <Money cents={pending} className="text-2xl md:text-3xl" />
            <span className="text-xs text-muted">{open.length} demande{open.length > 1 ? "s" : ""} en cours</span>
          </div>
          <a
            href="#a-faire"
            className={`flex flex-col gap-2 rounded-[24px] border p-4 md:p-5 ${needsYou.length ? "border-warning/50 bg-warning-soft text-on-warning-soft" : "border-line bg-raised"}`}
          >
            <span className={`overline ${needsYou.length ? "" : "text-muted"}`}>Besoin de toi</span>
            <span className="text-3xl font-bold">{needsYou.length}</span>
            <span className={`text-xs ${needsYou.length ? "" : "text-muted"}`}>{needsYou.length ? "Une info et l'agent repart" : "Rien à faire, on gère"}</span>
          </a>
        </div>
      </section>

      {/* What needs the user */}
      {needsYou.length > 0 && (
        <section id="a-faire" className="flex scroll-mt-20 flex-col gap-3">
          <h2 className="text-xl font-bold">À faire</h2>
          <ul className="grid gap-3 md:grid-cols-2">
            {needsYou.map((c) => (
              <li key={c.id}>
                <Link href={`/claims/${c.id}`} className="flex items-center gap-4 rounded-[24px] border border-warning/50 bg-raised p-4 transition hover:border-warning">
                  <Candy kind="claim" size={40} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.product}</p>
                    <p className="truncate text-sm text-muted">
                      {c.status === "waiting_input"
                        ? `La marque demande : ${c.missingFields.join(", ")}`
                        : c.status === "needs_manual"
                          ? "Ce site ne se laisse pas faire : à envoyer toi-même"
                          : "L'agent a échoué : relance-le"}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-surface">
                    {c.status === "waiting_input" ? "Répondre" : "Voir"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Every claim */}
      {claims.length > 0 ? (
        <ClaimsBoard claims={claims} />
      ) : (
        <section className="panel panel-scan flex flex-col gap-5 rounded-[28px] p-6 md:p-10">
          <h2 className="title-tight text-3xl font-bold md:text-5xl">Scanne. Coche. Réclame. Récupère.</h2>
          <ol className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {([
              ["scan", "Scanne", "ton ticket de caisse"],
              ["check", "Coche", "le produit qui a un problème"],
              ["claim", "Réclame", "notre agent écrit à la marque"],
              ["recover", "Récupère", "le remboursement arrive ici"],
            ] as const).map(([kind, verb, text]) => (
              <li key={kind} className="flex items-center gap-3 rounded-[20px] bg-white/60 p-3">
                <Candy kind={kind} size={40} />
                <span className="text-sm"><b>{verb}</b> {text}</span>
              </li>
            ))}
          </ol>
          <Link href="/receipts/new" className="self-start rounded-[14px] bg-[#111714] px-5 py-3 font-bold text-[#F8F7F2]">
            Scanner mon premier ticket
          </Link>
        </section>
      )}

      <AutoRefresh syncClaimIds={submitting} />
      <InboxPoller />
    </div>
  );
}
