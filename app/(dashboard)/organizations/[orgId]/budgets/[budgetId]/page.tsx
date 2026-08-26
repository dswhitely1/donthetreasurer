import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { fetchBudgetReportData } from "@/lib/reports/fetch-budget-data";
import {
  BUDGET_STATUS_LABELS,
} from "@/lib/validations/budget";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BudgetDetailActions } from "./budget-actions";

import type { BudgetStatus } from "@/lib/validations/budget";

function getStatusBadgeVariant(
  status: BudgetStatus
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

export default async function BudgetDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; budgetId: string }>;
}) {
  const { orgId, budgetId } = await params;
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

  // Fetch budget header fields (name/dates/status/notes), scoped to this org
  const { data: budget } = await supabase
    .from("budgets")
    .select("id, name, start_date, end_date, status, notes")
    .eq("id", budgetId)
    .eq("organization_id", orgId)
    .single();

  if (!budget) {
    notFound();
  }

  // Signed-net budget vs. actuals data: one row per category, no
  // income/expense classification (categories no longer carry a type).
  const budgetData = await fetchBudgetReportData(supabase, budgetId);

  if (!budgetData) {
    notFound();
  }

  const budgetStatus = budget.status as BudgetStatus;
  const statusLabel = BUDGET_STATUS_LABELS[budgetStatus] ?? budget.status;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href={`/organizations/${orgId}/budgets`}
        className="mb-4 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to budgets
      </Link>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{budget.name}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                {formatDate(budget.start_date)} &ndash;{" "}
                {formatDate(budget.end_date)}
              </p>
            </div>
            <Badge variant={getStatusBadgeVariant(budgetStatus)}>
              {statusLabel}
            </Badge>
          </div>
          {budget.notes && (
            <p className="mt-2 text-sm text-muted-foreground">
              {budget.notes}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {/* Actions */}
          <BudgetDetailActions
            budgetId={budgetId}
            orgId={orgId}
            currentStatus={budgetStatus}
            budgetName={budget.name}
          />

          {/* Summary Cards */}
          <div className="mt-6 grid grid-cols-3 gap-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Budgeted Net
              </p>
              <p
                className={`text-lg font-bold tabular-nums ${
                  budgetData.netTotals.budgeted >= 0
                    ? "text-income"
                    : "text-expense"
                }`}
              >
                {formatCurrency(budgetData.netTotals.budgeted)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Actual Net
              </p>
              <p
                className={`text-lg font-bold tabular-nums ${
                  budgetData.netTotals.actual >= 0
                    ? "text-income"
                    : "text-expense"
                }`}
              >
                {formatCurrency(budgetData.netTotals.actual)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Variance
              </p>
              <p
                className={`text-lg font-bold tabular-nums ${
                  budgetData.netTotals.variance >= 0
                    ? "text-income"
                    : "text-expense"
                }`}
              >
                {formatCurrency(budgetData.netTotals.variance)}
              </p>
            </div>
          </div>

          {/* Budget vs. Actuals Table */}
          <div className="mt-6">
            <h3 className="mb-3 text-sm font-medium text-muted-foreground">
              Budget vs. Actuals
            </h3>
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="py-2 text-left font-medium">Category</th>
                    <th className="py-2 text-right font-medium">Budgeted</th>
                    <th className="py-2 text-right font-medium">Actual</th>
                    <th className="py-2 text-right font-medium">Variance</th>
                    <th className="py-2 text-right font-medium">
                      % of Plan
                    </th>
                    <th className="py-2 pl-4 text-left font-medium">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {budgetData.netLines.map((line) => {
                    // Clamp only the bar's width. The percentage text and every
                    // dollar figure below render unclamped, including negative
                    // percentages — a line that was supposed to net positive but
                    // lost money must show its real (negative) % of plan.
                    const barPercent =
                      line.percentOfPlan === null
                        ? 0
                        : Math.max(0, Math.min(line.percentOfPlan, 100));

                    return (
                      <tr key={line.categoryId} className="border-b">
                        <td className="py-2">{line.categoryName}</td>
                        <td className="py-2 text-right">
                          {formatCurrency(line.budgeted)}
                        </td>
                        <td className="py-2 text-right">
                          {formatCurrency(line.actual)}
                        </td>
                        <td
                          className={`py-2 text-right ${
                            line.favorable ? "text-income" : "text-expense"
                          }`}
                        >
                          {formatCurrency(line.variance)}
                        </td>
                        <td className="py-2 text-right">
                          {line.percentOfPlan === null
                            ? "—"
                            : `${line.percentOfPlan.toFixed(1)}%`}
                        </td>
                        <td className="py-2 pl-4">
                          <div className="h-2 w-24 overflow-hidden rounded bg-muted">
                            <div
                              className={`h-full ${
                                line.favorable ? "bg-income" : "bg-expense"
                              }`}
                              style={{ width: `${barPercent}%` }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Unbudgeted Actuals */}
          {budgetData.unbudgetedNet.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Unbudgeted Actuals
              </h3>
              <p className="mb-2 text-xs text-muted-foreground">
                Categories with actual transactions in this period that are not
                included in the budget.
              </p>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-muted-foreground">
                      <th className="py-2 text-left font-medium">
                        Category
                      </th>
                      <th className="py-2 text-right font-medium">
                        Actual
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {budgetData.unbudgetedNet.map((line) => (
                      <tr key={line.categoryId} className="border-b">
                        <td className="py-2">{line.categoryName}</td>
                        <td
                          className={`py-2 text-right ${
                            line.favorable ? "text-income" : "text-expense"
                          }`}
                        >
                          {formatCurrency(line.actual)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
