"use client";

import { useState } from "react";
import { Eye, Trash2, FileText, Image as ImageIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReceipts, useDeleteReceipt } from "@/hooks/use-receipts";
import { ReceiptPreviewDialog } from "./receipt-preview-dialog";

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function MimeIcon({ mimeType }: Readonly<{ mimeType: string }>) {
  if (mimeType === "application/pdf") {
    return <FileText className="h-4 w-4 text-red-500" />;
  }
  return <ImageIcon className="h-4 w-4 text-blue-500" />;
}

export function ReceiptList({
  transactionId,
  orgId,
  isReconciled,
}: Readonly<{
  transactionId: string;
  orgId: string;
  isReconciled: boolean;
}>) {
  const { data: receipts, isLoading, isError, error } = useReceipts(transactionId);
  const deleteMutation = useDeleteReceipt(transactionId);

  const [previewReceiptId, setPreviewReceiptId] = useState<string | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="text-sm text-destructive">{error.message}</p>
    );
  }

  if (!receipts || receipts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No receipts attached.</p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {receipts.map((receipt) => (
          <div
            key={receipt.id}
            className="flex items-center justify-between rounded-md border border-border px-3 py-2"
          >
            <div className="flex items-center gap-2 overflow-hidden">
              <MimeIcon mimeType={receipt.mime_type} />
              <span className="truncate text-sm">{receipt.file_name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {formatFileSize(receipt.file_size)}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreviewReceiptId(receipt.id);
                  setPreviewFileName(receipt.file_name);
                }}
              >
                <Eye className="h-4 w-4" />
                <span className="sr-only">View</span>
              </Button>

              {!isReconciled && (
                <>
                  {confirmingDeleteId === receipt.id ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={deleteMutation.isPending}
                        onClick={() => {
                          deleteMutation.mutate(
                            {
                              receiptId: receipt.id,
                              organizationId: orgId,
                            },
                            {
                              onSettled: () => setConfirmingDeleteId(null),
                            }
                          );
                        }}
                      >
                        {deleteMutation.isPending ? "Deleting\u2026" : "Confirm"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmingDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setConfirmingDeleteId(receipt.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete</span>
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {deleteMutation.isError && (
        <p className="mt-1 text-sm text-destructive">
          {deleteMutation.error.message}
        </p>
      )}

      {previewReceiptId && (
        <ReceiptPreviewDialog
          orgId={orgId}
          receiptId={previewReceiptId}
          fileName={previewFileName}
          open={!!previewReceiptId}
          onOpenChange={(open) => {
            if (!open) setPreviewReceiptId(null);
          }}
        />
      )}
    </>
  );
}
