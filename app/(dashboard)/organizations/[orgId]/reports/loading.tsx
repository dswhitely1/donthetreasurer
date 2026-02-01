import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsLoading() {
  return (
    <div>
      <div>
        <Skeleton className="h-8 w-32" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>

      {/* Filters skeleton */}
      <div className="mt-4 flex flex-wrap gap-3">
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-28" />
        <Skeleton className="h-9 w-28" />
      </div>

      {/* Empty state placeholder */}
      <div className="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
    </div>
  );
}
