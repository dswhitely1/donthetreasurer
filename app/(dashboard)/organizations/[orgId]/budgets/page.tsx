import { notFound } from "next/navigation";
import Link from "next/link";
import { PiggyBank, Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { BUDGET_STATUS_LABELS } from "@/lib/validations/budget";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";

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
      budget_line_items(id, amount, category_id)
    `
    )
    .eq("organization_id", orgId)
    .order("start_date", { ascending: false });

  const budgetList = budgets ?? [];

  return (
    <div>
      <PageHeader title="Budgets">
        <Button asChild>
          <Link href={`/organizations/${orgId}/budgets/new`}>
            <Plus className="mr-2 h-4 w-4" />
            New Budget
          </Link>
        </Button>
      </PageHeader>

      {budgetList.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={PiggyBank}
            title="No budgets yet"
            description="Create a budget to plan and track your organization's finances."
            action={{ label: "New Budget", href: `/organizations/${orgId}/budgets/new` }}
          />
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                  Name
                </th>
                <th className="hidden px-3 py-2.5 text-left font-medium text-muted-foreground sm:table-cell">
                  Date Range
                </th>
                <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">
                  Status
                </th>
                <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                  Net Budgeted
                </th>
                <th className="hidden px-3 py-2.5 text-right font-medium text-muted-foreground md:table-cell">
                  Items
                </th>
              </tr>
            </thead>
            <tbody>
              {budgetList.map((budget) => {
                const lineItems = budget.budget_line_items ?? [];
                // Computed here as a plain sum of line item amounts for the
                // list view, and separately in fetchBudgetReportData
                // (lib/reports/fetch-budget-data.ts) as netTotals.budgeted
                // for the detail view. Both must stay in agreement — if the
                // budgeted total's definition ever changes, update both.
                const netBudgeted = lineItems.reduce(
                  (sum, li) => sum + li.amount,
                  0
                );

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
                    <td className="hidden px-3 py-2.5 whitespace-nowrap text-muted-foreground sm:table-cell">
                      {formatDate(budget.start_date)} &ndash;{" "}
                      {formatDate(budget.end_date)}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <Badge variant={getStatusBadgeVariant(budget.status)}>
                        {statusLabel}
                      </Badge>
                    </td>
                    <td
                      className={`px-3 py-2.5 whitespace-nowrap text-right font-medium tabular-nums ${
                        netBudgeted >= 0 ? "text-income" : "text-expense"
                      }`}
                    >
                      {formatCurrency(netBudgeted)}
                    </td>
                    <td className="hidden px-3 py-2.5 text-right text-muted-foreground md:table-cell">
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
