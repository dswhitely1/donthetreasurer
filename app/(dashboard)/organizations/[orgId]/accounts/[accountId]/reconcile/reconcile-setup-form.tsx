"use client";

import { useActionState } from "react";

import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createReconciliationSession } from "./actions";

interface ReconcileSetupFormProps {
  accountId: string;
  lastReconciledBalance: number;
}

export function ReconcileSetupForm({
  accountId,
  lastReconciledBalance,
}: ReconcileSetupFormProps) {
  const [state, formAction, isPending] = useActionState(
    createReconciliationSession,
    null
  );

  const today = new Date().toISOString().split("T")[0];

  return (
    <Card className="mt-6 max-w-lg">
      <CardHeader>
        <CardTitle className="text-base">Statement Information</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="account_id" value={accountId} />

          <div>
            <Label className="text-sm font-medium text-muted-foreground">
              Last Reconciled Balance
            </Label>
            <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">
              {formatCurrency(lastReconciledBalance)}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="statement_date">Statement Date</Label>
            <Input
              id="statement_date"
              name="statement_date"
              type="date"
              defaultValue={today}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="statement_ending_balance">
              Statement Ending Balance
            </Label>
            <Input
              id="statement_ending_balance"
              name="statement_ending_balance"
              type="number"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>

          {state?.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={isPending}>
              {isPending ? "Starting..." : "Start Reconciliation"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
