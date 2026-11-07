// OWNER: Dev 1. Pick items + issue preset (ISSUE_LABELS_FR) + optional description
// → POST /api/claims → redirect to /claims.
export default async function SelectItemsPage({ params }: PageProps<"/receipts/[id]/select">) {
  const { id } = await params;
  return <h1 className="text-xl font-semibold">Sélection des produits ({id}) — TODO(dev1)</h1>;
}
