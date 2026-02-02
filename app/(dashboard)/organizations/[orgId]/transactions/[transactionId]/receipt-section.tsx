"use client";

import { Paperclip } from "lucide-react";

import { ReceiptUpload } from "./receipt-upload";
import { ReceiptList } from "./receipt-list";

export function ReceiptSection({
  transactionId,
  orgId,
  isReconciled,
}: Readonly<{
  transactionId: string;
  orgId: string;
  isReconciled: boolean;
}>) {
  return (
    <div className="mt-6 border-t border-border pt-6">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Paperclip className="h-4 w-4" />
          Receipts &amp; Documents
        </h3>
        {!isReconciled && (
          <ReceiptUpload transactionId={transactionId} orgId={orgId} />
        )}
      </div>
      <ReceiptList
        transactionId={transactionId}
        orgId={orgId}
        isReconciled={isReconciled}
      />
    </div>
  );
}
