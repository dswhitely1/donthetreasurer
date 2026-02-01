import { Skeleton } from "@/components/ui/skeleton";

export default function CategoriesLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40" />
          <Skeleton className="mt-2 h-4 w-64" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="mt-6 space-y-8">
        {/* Income section */}
        <div>
          <Skeleton className="mb-3 h-6 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card py-6 shadow-sm"
              >
                <div className="px-6 pb-2 flex items-start justify-between">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="px-6 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Expense section */}
        <div>
          <Skeleton className="mb-3 h-6 w-44" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-xl border bg-card py-6 shadow-sm"
              >
                <div className="px-6 pb-2 flex items-start justify-between">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <div className="px-6 space-y-2">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-4 w-28" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
