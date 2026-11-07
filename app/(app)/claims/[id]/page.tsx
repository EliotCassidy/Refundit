// OWNER: Dev 2. Claim detail: status, complaint text, H Agent View (live/replay),
// Cancel / Retry, email timeline. Calls POST /api/claims/:id/sync every 5s while submitting.
export default async function ClaimPage({ params }: PageProps<"/claims/[id]">) {
  const { id } = await params;
  return <h1 className="text-xl font-semibold">Réclamation {id} — TODO(dev2)</h1>;
}
