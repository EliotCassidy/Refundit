// Main dashboard (home): money received, money pending, what needs the user, every claim.
import Link from "next/link";
import { redirect } from "next/navigation";
import { BellRing, ChevronRight, Clock, Wallet } from "lucide-react";
import { Candy, Card, Money, StripeBadge } from "@/components/ui/brand";
import { displayLabel } from "@/components/ui/format";
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
    product: displayLabel(c.line_items?.product_name || c.line_items?.raw_label || "Produit"),
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
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-[28px] font-bold tracking-tight md:text-[32px]">Bonjour {profile.first_name}</h1>
        <p className="mt-1 text-[15px] text-muted">Voici où en sont tes remboursements.</p>
      </header>

      {/* KPIs */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 md:gap-4" aria-label="Résumé">
        <Card className="col-span-2 flex flex-col gap-4 p-5 md:col-span-1 md:p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-brand-soft text-brand-strong"><Wallet className="size-4" aria-hidden /></span>
            <span className="text-sm font-medium text-muted">Récupéré</span>
          </div>
          <Money cents={received} className="text-[36px] leading-none text-brand-strong md:text-[40px]" />
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
            <span className="text-xs text-muted">{refundedCount} remboursement{refundedCount > 1 ? "s" : ""}</span>
            <StripeBadge />
          </div>
        </Card>

        <Card className="flex flex-col gap-4 p-5 md:p-6">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-full bg-info-soft text-info"><Clock className="size-4" aria-hidden /></span>
            <span className="text-sm font-medium text-muted">En attente</span>
          </div>
          <Money cents={pending} className="text-[26px] leading-none md:text-[32px]" />
          <span className="text-xs text-muted">{open.length} demande{open.length > 1 ? "s" : ""} en cours</span>
        </Card>

        <a href={needsYou.length ? "#a-faire" : undefined} className="block">
          <Card className={`flex h-full flex-col gap-4 p-5 md:p-6 ${needsYou.length ? "border-warning/60" : ""}`}>
            <div className="flex items-center gap-2.5">
              <span className="grid size-8 place-items-center rounded-full bg-warning-soft text-on-warning-soft"><BellRing className="size-4" aria-hidden /></span>
              <span className="text-sm font-medium text-muted">Besoin de toi</span>
            </div>
            <span className="money text-[26px] leading-none md:text-[32px]">{needsYou.length}</span>
            <span className="text-xs text-muted">{needsYou.length ? "Une info et l'agent repart" : "Rien à faire, on gère"}</span>
          </Card>
        </a>
      </section>

      {/* What needs the user */}
      {needsYou.length > 0 && (
        <section id="a-faire" className="flex scroll-mt-20 flex-col gap-3">
          <h2 className="text-lg font-semibold">À faire</h2>
          <ul className="flex flex-col gap-2">
            {needsYou.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/claims/${c.id}`}
                  className="flex items-center gap-4 rounded-[16px] border border-line border-l-[3px] border-l-warning bg-raised px-4 py-3.5 transition hover:bg-sunken/40"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{c.product}</p>
                    <p className="truncate text-sm text-muted">
                      {c.status === "waiting_input"
                        ? `${c.brand ?? "La marque"} demande : ${c.missingFields.join(", ")}`
                        : c.status === "needs_manual"
                          ? "Ce site bloque l'agent : à envoyer toi-même"
                          : "L'agent a échoué : relance-le"}
                    </p>
                  </div>
                  <span className="hidden shrink-0 text-sm font-semibold text-ink sm:block">{c.status === "waiting_input" ? "Répondre" : "Voir"}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted" aria-hidden />
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
        <section className="panel panel-scan flex flex-col gap-5 rounded-[24px] p-6 md:p-10">
          <h2 className="text-2xl font-bold tracking-tight md:text-3xl">Scanne. Coche. Réclame. Récupère.</h2>
          <ol className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {([
              ["scan", "Scanne", "ton ticket de caisse"],
              ["check", "Coche", "le produit qui a un problème"],
              ["claim", "Réclame", "notre agent écrit à la marque"],
              ["recover", "Récupère", "le remboursement arrive ici"],
            ] as const).map(([kind, verb, text]) => (
              <li key={kind} className="flex items-center gap-3 rounded-[16px] bg-white/70 p-3">
                <Candy kind={kind} size={36} />
                <span className="text-sm"><b>{verb}</b> {text}</span>
              </li>
            ))}
          </ol>
          <Link href="/receipts/new" className="self-start rounded-[12px] bg-[#111714] px-5 py-3 text-sm font-semibold text-[#F8F7F2]">
            Scanner mon premier ticket
          </Link>
        </section>
      )}

      <AutoRefresh syncClaimIds={submitting} />
      <InboxPoller />
    </div>
  );
}
