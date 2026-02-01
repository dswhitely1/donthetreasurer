"use client";

import { useEffect } from "react";
import { AlertCircle } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-destructive/50 bg-destructive/5 p-12 text-center">
      <AlertCircle className="h-10 w-10 text-destructive" />
      <h2 className="mt-4 text-lg font-semibold text-foreground">
        Something went wrong
      </h2>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        An unexpected error occurred while loading this page. Please try again.
      </p>
      {error.digest && (
        <p className="mt-2 text-xs text-muted-foreground">
          Error ID: {error.digest}
        </p>
      )}
      <Button onClick={reset} className="mt-4">
        Try again
      </Button>
    </div>
  );
}
