// Skeleton while a claim loads.
export default function Loading() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Chargement">
      <div className="skeleton h-4 w-32" />
      <div className="flex flex-col gap-4 rounded-[20px] border border-line bg-raised p-5">
        <div className="skeleton h-3 w-40" />
        <div className="skeleton h-8 w-2/3" />
        <div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="skeleton h-1.5" />)}</div>
      </div>
      <div className="skeleton aspect-[4/3] w-full rounded-[20px]" />
    </div>
  );
}
