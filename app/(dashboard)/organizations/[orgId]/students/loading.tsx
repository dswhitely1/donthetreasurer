import { Skeleton } from "@/components/ui/skeleton";

export default function StudentsLoading() {
  return (
    <div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mt-4 rounded-lg border border-border">
        <div className="border-b border-border bg-muted/50 px-3 py-2.5">
          <Skeleton className="h-4 w-full" />
        </div>
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
