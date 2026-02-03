import { notFound } from "next/navigation";
import Link from "next/link";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BUDGET_STATUS_LABELS } from "@/lib/validations/budget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { BudgetStatus } from "@/lib/validations/budget";

function getStatusBadgeVariant(
  status: string
): "default" | "secondary" | "outline" {
  switch (status) {
    case "active":
      return "default";
    case "draft":
      return "secondary";
    case "closed":
      return "outline";
    default:
      return "secondary";
  }
}

export default async function BudgetsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  const { data: organization } = await supabase
    .from("organizations")
    .select("id")
    .eq("id", orgId)
    .eq("is_active", true)
    .single();

  if (!organization) {
    notFound();
  }

  const { data: budgets } = await supabase
    .from("budgets")
    .select(
      `
      *,
      budget_line_items(id, amount, category_id, categories(id, category_type))
    `
    )
    .eq("organization_id", orgId)
    .order("start_date", { ascending: false });

  const budgetList = budgets ?? [];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Budgets
        </h2>
        <Button asChild>
          <Link href={`/organizations/${orgId}/budgets/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Budget
          </Link>
        </Button>
      </div>

      {budgetList.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No budgets yet. Create a budget to plan and track your
            organization&apos;s finances.
          </p>
          <Button asChild className="mt-3" size="sm">
            <Link href={`/organizations/${orgId}/budgets/new`}>
              <Plus className="mr-2 h-4 w-4" />
              New Budget
            </Link>
          </Button>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Date Range
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Budgeted Income
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Budgeted Expenses
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Items
                </th>
              </tr>
            </thead>
            <tbody>
              {budgetList.map((budget) => {
                const lineItems = budget.budget_line_items ?? [];
                let budgetedIncome = 0;
                let budgetedExpenses = 0;

                for (const li of lineItems) {
                  const cat = li.categories as {
                    id: string;
                    category_type: string;
                  } | null;
                  if (cat?.category_type === "income") {
                    budgetedIncome += li.amount;
                  } else {
                    budgetedExpenses += li.amount;
                  }
                }

                const statusLabel =
                  BUDGET_STATUS_LABELS[budget.status as BudgetStatus] ??
                  budget.status;

                return (
                  <tr
                    key={budget.id}
                    className="border-b border-border last:border-b-0 hover:bg-muted/30"
                  >
                    <td className="px-3 py-2.5">
                      <Link
                        href={`/organizations/${orgId}/budgets/${budget.id}`}
                        className="font-medium hover:underline"
                      >
                        {budget.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                      {formatDate(budget.start_date)} &ndash;{" "}
                      {formatDate(budget.end_date)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant={getStatusBadgeVariant(budget.status)}>
                        {statusLabel}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right font-medium tabular-nums text-green-600 dark:text-green-400">
                      {budgetedIncome > 0
                        ? formatCurrency(budgetedIncome)
                        : "\u2014"}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-right font-medium tabular-nums text-red-600 dark:text-red-400">
                      {budgetedExpenses > 0
                        ? formatCurrency(budgetedExpenses)
                        : "\u2014"}
                    </td>
                    <td className="px-3 py-2.5 text-right text-muted-foreground">
                      {lineItems.length}
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
