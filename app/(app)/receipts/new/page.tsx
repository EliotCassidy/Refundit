// OWNER: Dev 1. Scanner un ticket : photo → POST /api/receipts → page du ticket.
import { UploadForm } from "./upload-form";

export default function NewReceiptPage() {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-xl font-semibold">Scanner un ticket</h1>
      <UploadForm />
    </div>
  );
}
