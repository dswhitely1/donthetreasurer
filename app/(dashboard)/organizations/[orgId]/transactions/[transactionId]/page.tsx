import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_STATUS_LABELS,
} from "@/lib/validations/transaction";
import { ACCOUNT_TYPE_LABELS } from "@/lib/validations/account";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TransactionActions } from "./transaction-actions";

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; transactionId: string }>;
}) {
  const { orgId, transactionId } = await params;
  const supabase = await createClient();

  // Verify org exists and user has access
  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!organization) {
    notFound();
  }

  // Fetch transaction with account and line items
  const { data: transaction } = await supabase
    .from("transactions")
    .select(
      `
      *,
      accounts!inner(id, name, account_type, organization_id),
      transaction_line_items(
        id,
        amount,
        memo,
        category_id,
        categories(id, name, parent_id, category_type)
      )
    `
    )
    .eq("id", transactionId)
    .eq("accounts.organization_id", orgId)
    .single();

  if (!transaction) {
    notFound();
  }

  // Fetch all categories to resolve parent names
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, category_type, parent_id")
    .eq("organization_id", orgId);

  const categoryNameMap = new Map(
    (allCategories ?? []).map((c) => [c.id, c.name])
  );

  // Fetch active accounts and categories for edit form
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, account_type, fee_percentage, fee_flat_amount, fee_category_id")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  const { data: activeCategories } = await supabase
    .from("categories")
    .select("id, name, category_type, parent_id")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  const lineItems = transaction.transaction_line_items ?? [];

  const typeLabel =
    TRANSACTION_TYPE_LABELS[
      transaction.transaction_type as keyof typeof TRANSACTION_TYPE_LABELS
    ] ?? transaction.transaction_type;

  const statusLabel =
    TRANSACTION_STATUS_LABELS[
      transaction.status as keyof typeof TRANSACTION_STATUS_LABELS
    ] ?? transaction.status;

  const statusVariant =
    transaction.status === "reconciled"
      ? ("default" as const)
      : transaction.status === "cleared"
        ? ("secondary" as const)
        : ("outline" as const);

  const accountTypeLabel =
    ACCOUNT_TYPE_LABELS[
      transaction.accounts.account_type as keyof typeof ACCOUNT_TYPE_LABELS
    ] ?? transaction.accounts.account_type;

  const isIncome = transaction.transaction_type === "income";

  return (
    <div className="mx-auto max-w-2xl">
      <Link
        href={`/organizations/${orgId}/transactions`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to transactions
      </Link>

      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <CardTitle>{transaction.description}</CardTitle>
            <div className="flex gap-2">
              <Badge
                variant="secondary"
                className={
                  isIncome
                    ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                    : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                }
              >
                {typeLabel}
              </Badge>
              <Badge variant={statusVariant}>{statusLabel}</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="font-medium text-muted-foreground">Amount</dt>
              <dd
                className={`mt-1 text-lg font-semibold tabular-nums ${
                  isIncome
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {isIncome ? "+" : "-"}
                {formatCurrency(transaction.amount)}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                Transaction Date
              </dt>
              <dd className="mt-1 text-foreground">
                {new Date(
                  transaction.transaction_date + "T00:00:00"
                ).toLocaleDateString()}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">Account</dt>
              <dd className="mt-1 text-foreground">
                {transaction.accounts.name}{" "}
                <span className="text-muted-foreground">
                  ({accountTypeLabel})
                </span>
              </dd>
            </div>
            {transaction.check_number && (
              <div>
                <dt className="font-medium text-muted-foreground">Check #</dt>
                <dd className="mt-1 text-foreground">
                  {transaction.check_number}
                </dd>
              </div>
            )}
            {transaction.vendor && (
              <div>
                <dt className="font-medium text-muted-foreground">Vendor</dt>
                <dd className="mt-1 text-foreground">
                  {transaction.vendor}
                </dd>
              </div>
            )}
            {transaction.cleared_at && (
              <div>
                <dt className="font-medium text-muted-foreground">
                  Cleared Date
                </dt>
                <dd className="mt-1 text-foreground">
                  {formatDate(transaction.cleared_at.slice(0, 10))}
                </dd>
              </div>
            )}
            <div>
              <dt className="font-medium text-muted-foreground">Created</dt>
              <dd className="mt-1 text-foreground">
                {transaction.created_at
                  ? new Date(transaction.created_at).toLocaleDateString()
                  : "N/A"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-muted-foreground">
                Last Updated
              </dt>
              <dd className="mt-1 text-foreground">
                {transaction.updated_at
                  ? new Date(transaction.updated_at).toLocaleDateString()
                  : "N/A"}
              </dd>
            </div>
          </dl>

          {/* Line Items Table */}
          <div className="mt-6 border-t border-border pt-6">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Line Items
            </h3>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Category
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                      Memo
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((li) => {
                    const cat = li.categories;
                    let categoryDisplay: string;
                    if (cat && cat.parent_id) {
                      const parentName =
                        categoryNameMap.get(cat.parent_id) ?? "";
                      categoryDisplay = parentName
                        ? `${parentName} → ${cat.name}`
                        : cat.name;
                    } else if (cat) {
                      categoryDisplay = cat.name;
                    } else {
                      categoryDisplay = "Unknown";
                    }

                    return (
                      <tr
                        key={li.id}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2">{categoryDisplay}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(li.amount)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {li.memo || "\u2014"}
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="bg-muted/30 font-medium">
                    <td className="px-3 py-2">Total</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatCurrency(transaction.amount)}
                    </td>
                    <td className="px-3 py-2" />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <TransactionActions
            transaction={{
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
            }}
            lineItems={lineItems.map((li) => ({
              category_id: li.category_id,
              amount: li.amount,
              memo: li.memo,
            }))}
            orgId={orgId}
            accounts={accounts ?? []}
            categories={activeCategories ?? []}
          />
        </CardContent>
      </Card>
    </div>
  );
}
