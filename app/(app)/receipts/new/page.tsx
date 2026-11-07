// Scanner un ticket : photo → POST /api/receipts → page du ticket.
import { UploadForm } from "./upload-form";

export default function NewReceiptPage() {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 pt-2 md:pt-6">
      <header className="text-center">
        <h1 className="text-[28px] font-bold tracking-tight md:text-[32px]">Scanne ton ticket</h1>
        <p className="mt-1.5 text-[15px] text-muted">Une photo, et on s&apos;occupe du reste.</p>
      </header>
      <UploadForm />
    </div>
  );
}
