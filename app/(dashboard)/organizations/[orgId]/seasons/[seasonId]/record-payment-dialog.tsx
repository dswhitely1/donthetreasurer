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
import { recordPayment } from "../actions";

interface RecordPaymentDialogProps {
  enrollmentId: string;
  studentName: string;
  balance: number;
}

export function RecordPaymentDialog({
  enrollmentId,
  studentName,
  balance,
}: Readonly<RecordPaymentDialogProps>) {
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().split("T")[0];

  const [state, formAction, pending] = useActionState(
    async (_prev: { error: string } | null, formData: FormData) => {
      const result = await recordPayment(_prev, formData);
      if (!result?.error) {
        setOpen(false);
      }
      return result;
    },
    null
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          Pay
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record Payment &mdash; {studentName}</DialogTitle>
        </DialogHeader>

        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="enrollment_id" value={enrollmentId} />

          {state?.error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {state.error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-date">Date</Label>
            <Input
              id="payment-date"
              name="payment_date"
              type="date"
              required
              defaultValue={today}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-amount">Amount</Label>
            <Input
              id="payment-amount"
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              required
              defaultValue={balance > 0 ? balance.toFixed(2) : ""}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-method">Method (optional)</Label>
            <Input
              id="payment-method"
              name="payment_method"
              maxLength={100}
              placeholder='e.g. "Cash", "Check #1234"'
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="payment-notes">Notes (optional)</Label>
            <Input
              id="payment-notes"
              name="notes"
              maxLength={500}
            />
          </div>

          <Button type="submit" disabled={pending}>
            {pending ? "Recording\u2026" : "Record Payment"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
