"use client";

import { useActionState, useEffect, useState } from "react";
import { Lock, Repeat } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { deleteTransaction } from "../actions";
import { TransactionForm } from "../transaction-form";
import { CategoryReassignForm } from "./category-reassign-form";
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
  const [isReassigning, setIsReassigning] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const [deleteState, deleteAction, deletePending] = useActionState(
    deleteTransaction,
    null
  );

  useEffect(() => {
    if (deleteState?.error) {
      toast.error("Failed to delete transaction", { description: deleteState.error });
    }
  }, [deleteState?.error]);

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

  if (isReassigning) {
    return (
      <div className="mt-6 border-t border-border pt-6">
        <CategoryReassignForm
          transactionId={transaction.id}
          orgId={orgId}
          transactionAmount={transaction.amount}
          transactionType={transaction.transaction_type}
          lineItems={lineItems}
          categories={categories}
          onCancel={() => setIsReassigning(false)}
        />
      </div>
    );
  }

  return (
    <div className="mt-6 border-t border-border pt-6">
      {isReconciled ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>
              This transaction is reconciled. Only category reassignment is allowed.
            </span>
          </div>
          <div>
            <Button variant="outline" onClick={() => setIsReassigning(true)}>
              Reassign Categories
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" onClick={() => setIsEditing(true)}>
              Edit
            </Button>

            <Button variant="outline" asChild>
              <Link
                href={`/organizations/${orgId}/templates/new?from_transaction=${transaction.id}`}
              >
                <Repeat className="mr-2 h-4 w-4" />
                Create Template
              </Link>
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
