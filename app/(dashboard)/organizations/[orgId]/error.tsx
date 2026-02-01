"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function OrgError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("Organization error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 p-12 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Failed to load organization
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        There was a problem loading this organization&apos;s data. The
        organization may not exist or you may not have access.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
      <div className="mt-4 flex gap-3">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" asChild>
          <Link href="/organizations">All organizations</Link>
        </Button>
      </div>
    </div>
  );
}
