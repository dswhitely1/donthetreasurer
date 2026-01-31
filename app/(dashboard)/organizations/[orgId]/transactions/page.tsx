import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_STATUS_LABELS,
} from "@/lib/validations/transaction";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  // Verify org exists and user has access
  const { data: organization } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!organization) {
    notFound();
  }

  // Fetch transactions with account info and line items with categories
  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      `
      *,
      accounts!inner(id, name, organization_id),
      transaction_line_items(
        id,
        amount,
        category_id,
        categories(id, name, parent_id, category_type)
      )
    `
    )
    .eq("accounts.organization_id", orgId)
    .order("transaction_date", { ascending: false });

  // Fetch all categories to resolve parent names
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name")
    .eq("organization_id", orgId);

  const categoryNameMap = new Map(
    (allCategories ?? []).map((c) => [c.id, c.name])
  );

  const allTransactions = transactions ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Transactions
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage transactions for {organization.name}.
          </p>
        </div>
        <Button asChild>
          <Link href={`/organizations/${orgId}/transactions/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Transaction
          </Link>
        </Button>
      </div>

      {allTransactions.length === 0 ? (
        <div className="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="text-lg font-semibold text-foreground">
            No transactions yet
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Record your first transaction to start tracking finances.
          </p>
          <Button asChild className="mt-4">
            <Link href={`/organizations/${orgId}/transactions/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Transaction
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Description
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Account
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Category
                </th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {allTransactions.map((txn) => {
                const lineItems = txn.transaction_line_items ?? [];
                const isIncome = txn.transaction_type === "income";

                // Build category display
                let categoryDisplay: string;
                if (lineItems.length === 0) {
                  categoryDisplay = "Uncategorized";
                } else if (lineItems.length === 1) {
                  const li = lineItems[0];
                  const cat = li.categories;
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
                } else {
                  categoryDisplay = `Multiple (${lineItems.length})`;
                }

                const statusLabel =
                  TRANSACTION_STATUS_LABELS[
                    txn.status as keyof typeof TRANSACTION_STATUS_LABELS
                  ] ?? txn.status;

                const statusVariant =
                  txn.status === "reconciled"
                    ? ("default" as const)
                    : txn.status === "cleared"
                      ? ("secondary" as const)
                      : ("outline" as const);

                return (
                  <tr
                    key={txn.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(
                        txn.transaction_date + "T00:00:00"
                      ).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/organizations/${orgId}/transactions/${txn.id}`}
                        className="font-medium hover:underline"
                      >
                        {txn.description}
                      </Link>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {txn.accounts?.name ?? "Unknown"}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                      {categoryDisplay}
                    </td>
                    <td
                      className={`px-4 py-3 whitespace-nowrap text-right font-medium tabular-nums ${
                        isIncome ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                      }`}
                    >
                      {isIncome ? "+" : "-"}
                      {formatCurrency(txn.amount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <Badge variant={statusVariant}>{statusLabel}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
