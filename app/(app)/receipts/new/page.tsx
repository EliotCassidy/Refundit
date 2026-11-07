// Scanner un ticket : photo → POST /api/receipts → page du ticket.
import { Candy } from "@/components/ui/brand";
import { UploadForm } from "./upload-form";

export default function NewReceiptPage() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-5">
      <header className="panel panel-scan flex items-center gap-4 rounded-[28px] p-5 md:p-6">
        <Candy kind="scan" size={52} />
        <div>
          <h1 className="title-tight text-[34px] font-bold md:text-[44px]">Scanne</h1>
          <p className="text-sm text-[#5B635E]">ton ticket de caisse. On s&apos;occupe du reste.</p>
        </div>
      </header>
      <UploadForm />
      <ol className="grid grid-cols-3 gap-2 text-center text-xs text-muted">
        <li className="rounded-[14px] bg-raised p-2"><b className="text-ink">1.</b> Photo du ticket</li>
        <li className="rounded-[14px] bg-raised p-2"><b className="text-ink">2.</b> Tu coches le produit</li>
        <li className="rounded-[14px] bg-raised p-2"><b className="text-ink">3.</b> L&apos;agent réclame</li>
      </ol>
    </div>
  );
}
