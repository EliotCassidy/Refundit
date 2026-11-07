// Skeleton while the dashboard loads.
export default function Loading() {
  return (
    <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8" aria-busy="true" aria-label="Chargement">
      <div className="flex flex-col items-center gap-3 rounded-[28px] border border-line bg-raised px-5 pb-6 pt-8">
        <div className="skeleton h-4 w-44" />
        <div className="skeleton h-14 w-56" />
        <div className="skeleton h-6 w-64 rounded-full" />
        <div className="mt-5 grid w-full grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <div className="skeleton size-14 rounded-full" />
              <div className="skeleton h-3 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <div className="skeleton h-5 w-24" />
        <div className="skeleton h-9 w-80 rounded-full" />
        <div className="overflow-hidden rounded-[20px] border border-line bg-raised">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`flex items-center gap-3.5 px-4 py-3.5 ${i ? "border-t border-line" : ""}`}>
              <div className="skeleton size-11 rounded-full" />
              <div className="flex flex-1 flex-col gap-2"><div className="skeleton h-4 w-2/3" /><div className="skeleton h-3 w-1/3" /></div>
              <div className="skeleton h-4 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
