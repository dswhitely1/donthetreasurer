"use client";

import { ExternalLink, Loader2 } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useReceiptSignedUrl } from "@/hooks/use-receipts";

export function ReceiptPreviewDialog({
  orgId,
  receiptId,
  fileName,
  open,
  onOpenChange,
}: Readonly<{
  orgId: string;
  receiptId: string;
  fileName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}>) {
  const { data, isLoading, isError, error } = useReceiptSignedUrl(
    orgId,
    receiptId
  );

  const isImage = data?.mimeType?.startsWith("image/");
  const isPdf = data?.mimeType === "application/pdf";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="truncate">{fileName}</DialogTitle>
        </DialogHeader>

        <div className="min-h-[200px]">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {isError && (
            <p className="py-12 text-center text-sm text-destructive">
              {error.message}
            </p>
          )}

          {data && isImage && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={data.signedUrl}
              alt={fileName}
              className="mx-auto max-h-[60vh] rounded-md object-contain"
            />
          )}

          {data && isPdf && (
            <iframe
              src={data.signedUrl}
              title={fileName}
              className="h-[60vh] w-full rounded-md border"
            />
          )}
        </div>

        {data && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a
                href={data.signedUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Download
              </a>
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
