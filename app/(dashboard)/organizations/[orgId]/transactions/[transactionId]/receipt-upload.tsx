"use client";

import { useRef } from "react";
import { Upload, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useUploadReceipt } from "@/hooks/use-receipts";
import {
  ALLOWED_RECEIPT_MIME_TYPES,
  MAX_RECEIPT_FILE_SIZE,
} from "@/lib/validations/receipt";

export function ReceiptUpload({
  transactionId,
  orgId,
}: Readonly<{
  transactionId: string;
  orgId: string;
}>) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadReceipt(transactionId);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (file.size > MAX_RECEIPT_FILE_SIZE) {
      upload.reset();
      alert("File size must be 5 MB or less.");
      return;
    }

    if (
      !ALLOWED_RECEIPT_MIME_TYPES.includes(
        file.type as (typeof ALLOWED_RECEIPT_MIME_TYPES)[number]
      )
    ) {
      upload.reset();
      alert("File type must be JPEG, PNG, WebP, or PDF.");
      return;
    }

    upload.mutate({ file, organizationId: orgId });
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept={ALLOWED_RECEIPT_MIME_TYPES.join(",")}
        onChange={handleFileChange}
        className="hidden"
        aria-label="Upload receipt file"
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={upload.isPending}
      >
        {upload.isPending ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        {upload.isPending ? "Uploading\u2026" : "Upload Receipt"}
      </Button>
      {upload.isError && (
        <p className="mt-1 text-sm text-destructive">{upload.error.message}</p>
      )}
    </div>
  );
}
