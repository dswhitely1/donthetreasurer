"use client";

import { useActionState, useState } from "react";
import { Lock } from "lucide-react";

import { updateTransaction, deleteTransaction } from "../actions";
import { TransactionForm } from "../transaction-form";
import { Button } from "@/components/ui/button";

import type { Tables } from "@/types/database";

type Account = Pick<
  Tables<"accounts">,
  "id" | "name" | "account_type" | "fee_percentage" | "fee_flat_amount" | "fee_category_id"
>;
type Category = Pick<
  Tables<"categories">,
  "id" | "name" | "category_type" | "parent_id"
>;

interface TransactionData {
  id: string;
  account_id: string;
  transaction_date: string;
  amount: number;
  transaction_type: string;
  description: string;
  check_number: string | null;
  vendor: string | null;
  status: string;
  cleared_at: string | null;
}

interface LineItemData {
  category_id: string;
  amount: number;
  memo: string | null;
}

export function TransactionActions({
  transaction,
  lineItems,
  orgId,
  accounts,
  categories,
}: Readonly<{
  transaction: TransactionData;
  lineItems: LineItemData[];
  orgId: string;
  accounts: Account[];
  categories: Category[];
}>) {
  const [isEditing, setIsEditing] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTransaction,
    null
  );

  const isReconciled = transaction.status === "reconciled";

  if (isEditing) {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <TransactionForm
          mode="edit"
          accounts={accounts}
          categories={categories}
          defaultValues={{
            id: transaction.id,
            account_id: transaction.account_id,
            transaction_date: transaction.transaction_date,
            amount: transaction.amount,
            transaction_type: transaction.transaction_type,
            description: transaction.description,
            check_number: transaction.check_number,
            vendor: transaction.vendor,
            status: transaction.status,
            cleared_at: transaction.cleared_at,
            line_items: lineItems,
          }}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      {isReconciled ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Lock className="h-4 w-4" />
          <span>
            This transaction is reconciled and cannot be edited or deleted.
          </span>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>

            {isConfirmingDelete ? (
              <>
                <form action={deleteAction}>
                  <input type="hidden" name="id" value={transaction.id} />
                  <input
                    type="hidden"
                    name="organization_id"
                    value={orgId}
                  />
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={deletePending}
                  >
                    {deletePending ? "Deleting\u2026" : "Confirm Delete"}
                  </Button>
                </form>
                <Button
                  variant="outline"
                  onClick={() => setIsConfirmingDelete(false)}
                >
                  Cancel
                </Button>
                {deleteState?.error && (
                  <span className="self-center text-sm text-destructive">
                    {deleteState.error}
                  </span>
                )}
              </>
            ) : (
              <Button
                variant="outline"
                onClick={() => setIsConfirmingDelete(true)}
              >
                Delete
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
