import { Skeleton } from "@/components/ui/skeleton";

export default function ReconcileSetupLoading() {
  return (
    <div>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-8 w-64" />
      <Skeleton className="mt-2 h-4 w-80" />
      <div className="mt-6 max-w-lg rounded-xl border bg-card p-6 shadow-sm">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  );
}
