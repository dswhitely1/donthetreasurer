import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="mx-auto max-w-2xl">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="mt-2 h-4 w-64" />

      <div className="mt-6 space-y-6">
        {/* Profile card skeleton */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-6 pb-4">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="mt-1 h-4 w-40" />
          </div>
          <div className="space-y-4 px-6 pb-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-28" />
          </div>
        </div>

        {/* Password card skeleton */}
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="p-6 pb-4">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-1 h-4 w-48" />
          </div>
          <div className="space-y-4 px-6 pb-6">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-9 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-9 w-full" />
            </div>
            <Skeleton className="h-9 w-36" />
          </div>
        </div>

        {/* Danger zone card skeleton */}
        <div className="rounded-xl border border-destructive/50 bg-card shadow-sm">
          <div className="p-6 pb-4">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-1 h-4 w-72" />
          </div>
          <div className="px-6 pb-6">
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
