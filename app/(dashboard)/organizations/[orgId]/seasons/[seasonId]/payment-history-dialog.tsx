"use client";

import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils";
import { updatePayment, deletePayment } from "../actions";

import type { Tables } from "@/types/database";

interface PaymentHistoryDialogProps {
  studentName: string;
  payments: Tables<"season_payments">[];
}

function EditPaymentForm({
  payment,
  onDone,
}: Readonly<{
  payment: Tables<"season_payments">;
  onDone: () => void;
}>) {
  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => {
      const result = await updatePayment(_prev, formData);
      if (!result?.error) onDone();
      return result;
    },
    null
  );

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-border p-3">
      <input type="hidden" name="id" value={payment.id} />
      <input type="hidden" name="enrollment_id" value={payment.enrollment_id} />

      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Date</Label>
          <Input
            name="payment_date"
            type="date"
            required
            defaultValue={payment.payment_date}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Amount</Label>
          <Input
            name="amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            defaultValue={String(payment.amount)}
          />
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Method</Label>
          <Input
            name="payment_method"
            maxLength={100}
            defaultValue={payment.payment_method ?? ""}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Notes</Label>
          <Input
            name="notes"
            maxLength={500}
            defaultValue={payment.notes ?? ""}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending}>
          {pending ? "Saving\u2026" : "Save"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function PaymentHistoryDialog({
  studentName,
  payments,
}: Readonly<PaymentHistoryDialogProps>) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [deleteState, deleteAction, deletePending] = useActionState(
    deletePayment,
    null
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          History ({payments.length})
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Payment History &mdash; {studentName}</DialogTitle>
        </DialogHeader>

        {deleteState?.error && (
          <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {deleteState.error}
          </div>
        )}

        {payments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No payments recorded.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {payments.map((payment) => {
              if (editingId === payment.id) {
                return (
                  <EditPaymentForm
                    key={payment.id}
                    payment={payment}
                    onDone={() => setEditingId(null)}
                  />
                );
              }

              return (
                <div
                  key={payment.id}
                  className="flex items-center justify-between rounded-md border border-border p-3"
                >
                  <div>
                    <p className="font-medium tabular-nums">
                      {formatCurrency(Number(payment.amount))}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(payment.payment_date)}
                      {payment.payment_method &&
                        ` \u2014 ${payment.payment_method}`}
                    </p>
                    {payment.notes && (
                      <p className="text-xs text-muted-foreground">
                        {payment.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(payment.id)}
                    >
                      Edit
                    </Button>
                    {confirmDeleteId === payment.id ? (
                      <>
                        <form action={deleteAction}>
                          <input
                            type="hidden"
                            name="id"
                            value={payment.id}
                          />
                          <Button
                            type="submit"
                            variant="destructive"
                            size="sm"
                            disabled={deletePending}
                          >
                            {deletePending ? "Deleting\u2026" : "Confirm"}
                          </Button>
                        </form>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmDeleteId(payment.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
