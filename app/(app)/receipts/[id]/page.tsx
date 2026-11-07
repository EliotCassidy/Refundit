// OWNER: Dev 1. Parsed receipt: store, date, line items with recognized brands.
export default async function ReceiptPage({ params }: PageProps<"/receipts/[id]">) {
  const { id } = await params;
  return <h1 className="text-xl font-semibold">Ticket {id} — TODO(dev1)</h1>;
}
