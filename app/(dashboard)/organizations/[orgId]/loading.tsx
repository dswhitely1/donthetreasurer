import { Skeleton } from "@/components/ui/skeleton";

export default function OrgOverviewLoading() {
  return (
    <div>
      {/* Page header */}
      <div>
        <Skeleton className="h-8 w-64" />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-5 w-28 rounded-full" />
        </div>
      </div>

      {/* Summary balance cards */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card py-6 shadow-sm"
          >
            <div className="px-6 pb-2">
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="px-6">
              <Skeleton className="h-8 w-28" />
              {i === 0 && <Skeleton className="mt-2 h-3 w-20" />}
            </div>
          </div>
        ))}
      </div>

      {/* Quick actions */}
      <div className="mt-6 flex flex-wrap gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-36" />
        ))}
      </div>

      {/* Recent transactions */}
      <div className="mt-8">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="h-8 w-20" />
        </div>
        <div className="mt-3 rounded-lg border">
          <div className="border-b bg-muted/50 px-3 py-2.5">
            <div className="flex gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-4 w-20" />
              ))}
            </div>
          </div>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border-b px-3 py-2.5 last:border-b-0">
              <div className="flex gap-4">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-6" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
