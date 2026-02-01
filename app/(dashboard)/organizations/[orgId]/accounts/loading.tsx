import { Skeleton } from "@/components/ui/skeleton";

export default function AccountsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-36" />
          <Skeleton className="mt-2 h-4 w-56" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl border bg-card py-6 shadow-sm"
          >
            <div className="px-6">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="mt-2 h-4 w-44" />
            </div>
            <div className="mt-4 px-6 flex items-center justify-between">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-24" />
            </div>
            <div className="mt-3 border-t border-border mx-6 pt-3 flex gap-4">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
