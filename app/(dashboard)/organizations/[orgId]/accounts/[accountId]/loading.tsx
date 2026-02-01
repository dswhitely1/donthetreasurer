import { Skeleton } from "@/components/ui/skeleton";

export default function AccountDetailLoading() {
  return (
    <div>
      {/* Back link */}
      <Skeleton className="mb-4 h-4 w-32" />

      {/* Page header */}
      <div>
        <Skeleton className="h-8 w-48" />
        <div className="mt-2 flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>

      {/* Status balance cards */}
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

      {/* Account details card */}
      <div className="mt-6 rounded-xl border bg-card py-6 shadow-sm">
        <div className="px-6 pb-4">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="px-6">
          <div className="grid gap-4 sm:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-4 w-20" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
