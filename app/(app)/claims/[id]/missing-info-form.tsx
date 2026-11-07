"use client";
// OWNER: Dev 2. Asks the user for the fields the brand requires, then resubmits.
// Yes/no questions (label ending with "?") get two big buttons instead of a text field.
import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { MessageCircleQuestion, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { group } from "@/components/ui/list";

const isYesNo = (label: string) => label.trim().endsWith("?");

export function MissingInfoForm({ claimId, fields, answers }: { claimId: string; fields: string[]; answers: Record<string, string> }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((f) => [f, answers[f] ?? ""])));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const complete = fields.every((f) => values[f]?.trim());

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const res = await fetch(`/api/claims/${claimId}/answers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answers: Object.fromEntries(Object.entries(values).filter(([, v]) => v.trim())) }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) setError(body?.error?.message ?? "Erreur");
    else if (body?.remaining?.length) setError(`Il manque encore : ${body.remaining.join(", ")}`);
    else toast.success("Merci ! L'agent repart avec tes réponses");
    setPending(false);
    router.refresh();
  }

  return (
    <section className={`${group} ring-warning/40`}>
      <div className="flex items-start gap-3.5 px-5 pb-3 pt-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-full bg-warning-soft text-on-warning-soft"><MessageCircleQuestion className="size-[18px]" aria-hidden /></span>
        <div>
          <h2 className="text-[16px] font-semibold">La marque a besoin de toi</h2>
          <p className="mt-0.5 text-[13px] text-muted">
            {fields.length > 1 ? "Ces infos sont" : "Cette info est"} souvent sur l&apos;emballage. Dès que tu réponds, l&apos;agent repart.
          </p>
        </div>
      </div>
      <form onSubmit={submit} className="flex flex-col">
        <div className="divide-y divide-black/[0.05] border-y border-black/[0.05]">
          {fields.map((f) => (
            <div key={f} className="flex flex-col gap-2.5 px-5 py-4">
              <span className="text-[15px] font-medium">{f}</span>
              {isYesNo(f) ? (
                <div className="grid grid-cols-2 gap-1 rounded-full bg-black/[0.05] p-1" role="radiogroup" aria-label={f}>
                  {["Oui", "Non"].map((v) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={values[f] === v}
                      onClick={() => setValues((s) => ({ ...s, [f]: v }))}
                      className="relative rounded-full py-2 text-[15px] font-medium"
                    >
                      {values[f] === v && (
                        <motion.span layoutId={`yn-${f}`} className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(17,23,20,0.14)]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />
                      )}
                      <span className={`relative ${values[f] === v ? "text-ink" : "text-muted"}`}>{v}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <input
                  value={values[f]}
                  onChange={(e) => setValues((s) => ({ ...s, [f]: e.target.value }))}
                  placeholder="Ta réponse"
                  className="h-11 rounded-[12px] bg-black/[0.04] px-3.5 text-[15px] text-ink outline-none ring-1 ring-transparent transition placeholder:text-muted/60 focus:bg-white focus:ring-ink/30"
                />
              )}
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 p-4">
          {error && <p className="px-1 text-sm text-on-danger-soft">{error}</p>}
          <Button type="submit" variant="dark" size="lg" block loading={pending} disabled={!complete} icon={<Send className="size-4" />}>
            Envoyer et relancer l&apos;agent
          </Button>
        </div>
      </form>
    </section>
  );
}
