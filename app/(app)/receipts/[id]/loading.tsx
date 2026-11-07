// Skeleton while a receipt loads.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" aria-busy="true" aria-label="Chargement">
      <div className="skeleton h-24 w-full rounded-[20px]" />
      <div className="skeleton h-16 w-full rounded-[20px]" />
      {[0, 1, 2].map((i) => <div key={i} className="skeleton h-28 w-full rounded-[20px]" />)}
    </div>
  );
}
