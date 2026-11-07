// OWNER: Dev 1. POST /api/receipts: upload + synchronous parse (API_CONTRACTS §5).
//
// TODO(dev1):
// 1. getUser() → 401 if none
// 2. read multipart `image` (jpeg/png/heic ≤ 10 MB)
// 3. upload to Storage bucket "receipts" at `${userId}/${receiptId}.jpg`
// 4. insert receipts row (status 'parsing'), parseReceipt() from lib/receipts/parse.ts
// 5. resolveBrand() per item, insert line_items, set status 'parsed' (or 'failed' + error)
// 6. return 201 { receiptId, status, items }
import { notImplemented } from "@/lib/shared/http";

export const maxDuration = 60;

export async function POST() {
  return notImplemented("POST /api/receipts");
}
