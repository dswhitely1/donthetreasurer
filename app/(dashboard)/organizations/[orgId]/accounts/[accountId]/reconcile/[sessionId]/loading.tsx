import { Skeleton } from "@/components/ui/skeleton";

export default function ReconcileMatchingLoading() {
  return (
    <div>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-48" />

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card py-6 shadow-sm"
          >
            <div className="px-6">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="mt-2 h-6 w-20" />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex gap-2">
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="mt-6 rounded-xl border bg-card p-6 shadow-sm">
        <Skeleton className="h-5 w-28" />
        <div className="mt-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
