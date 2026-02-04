import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { buildCombinedBudgetLines } from "@/lib/reports/budget-combined";
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

interface BudgetLineWithActuals {
  categoryId: string;
  categoryName: string;
  categoryType: "income" | "expense";
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number | null;
}

interface UnbudgetedActual {
  categoryId: string;
  categoryName: string;
  categoryType: "income" | "expense";
  actual: number;
}

function VarianceCell({ variance }: Readonly<{ variance: number }>) {
  // Variance is pre-computed: income = actual - budgeted, expense = budgeted - actual
  // So positive variance is always favorable regardless of type
  const isFavorable = variance >= 0;
  return (
    <span
      className={`tabular-nums ${
        isFavorable
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {variance >= 0 ? "+" : ""}
      {formatCurrency(variance)}
    </span>
  );
}

function NetCell({ value }: Readonly<{ value: number }>) {
  return (
    <span
      className={`tabular-nums ${
        value >= 0
          ? "text-green-600 dark:text-green-400"
          : "text-red-600 dark:text-red-400"
      }`}
    >
      {formatCurrency(value)}
    </span>
  );
}

function ProgressBar({
  actual,
  budgeted,
  type,
}: Readonly<{ actual: number; budgeted: number; type: "income" | "expense" }>) {
  if (budgeted === 0) return null;
  const pct = Math.min((actual / budgeted) * 100, 150);
  const isOver = actual > budgeted;

  return (
    <div className="h-2 w-full rounded-full bg-muted">
      <div
        className={`h-2 rounded-full transition-all ${
          isOver
            ? type === "expense"
              ? "bg-red-500"
              : "bg-green-500"
            : type === "expense"
              ? "bg-blue-500"
              : "bg-green-500"
        }`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  );
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

  // Fetch budget with line items (joined to categories)
  const { data: budget } = await supabase
    .from("budgets")
    .select(
      `
      *,
      budget_line_items(
        id,
        amount,
        notes,
        category_id,
        categories(id, name, category_type, parent_id)
      )
    `
    )
    .eq("id", budgetId)
    .eq("organization_id", orgId)
    .single();

  if (!budget) {
    notFound();
  }

  // Fetch all categories for this org (for parent name resolution + child lookup)
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, category_type, parent_id")
    .eq("organization_id", orgId);

  const categories = allCategories ?? [];
  const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));
  const categoryTypeMap = new Map(
    categories.map((c) => [c.id, c.category_type])
  );
  const childrenByParent = new Map<string, string[]>();
  for (const cat of categories) {
    if (cat.parent_id) {
      const existing = childrenByParent.get(cat.parent_id) ?? [];
      existing.push(cat.id);
      childrenByParent.set(cat.parent_id, existing);
    }
  }

  // Resolve category display name
  function resolveCategoryName(categoryId: string): string {
    const cat = categories.find((c) => c.id === categoryId);
    if (!cat) return "Unknown";
    if (cat.parent_id) {
      const parentName = categoryNameMap.get(cat.parent_id) ?? "";
      return parentName ? `${parentName} \u2192 ${cat.name}` : cat.name;
    }
    return cat.name;
  }

  // Build set of budgeted category IDs (including children of parent categories)
  const budgetedCategoryIds = new Set<string>();
  const lineItems = budget.budget_line_items ?? [];
  for (const li of lineItems) {
    budgetedCategoryIds.add(li.category_id);
    // If this is a parent category, also include its children for actuals
    const children = childrenByParent.get(li.category_id) ?? [];
    for (const childId of children) {
      budgetedCategoryIds.add(childId);
    }
  }

  // Fetch actuals: transaction line items within the budget date range
  // We need to query transactions in the date range, then sum line items per category
  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      `
      id,
      transaction_type,
      transaction_date,
      accounts!inner(organization_id),
      transaction_line_items(
        category_id,
        amount
      )
    `
    )
    .eq("accounts.organization_id", orgId)
    .gte("transaction_date", budget.start_date)
    .lte("transaction_date", budget.end_date);

  // Sum actuals per category
  const actualsByCategory = new Map<string, number>();
  for (const txn of transactions ?? []) {
    for (const li of txn.transaction_line_items ?? []) {
      const current = actualsByCategory.get(li.category_id) ?? 0;
      actualsByCategory.set(li.category_id, current + li.amount);
    }
  }

  // Build budget vs actuals rows
  const budgetLines: BudgetLineWithActuals[] = lineItems.map((li) => {
    const cat = li.categories as {
      id: string;
      name: string;
      category_type: string;
      parent_id: string | null;
    } | null;

    const categoryType = (cat?.category_type ?? "expense") as
      | "income"
      | "expense";

    // For parent categories, sum children actuals too
    let actual = actualsByCategory.get(li.category_id) ?? 0;
    const children = childrenByParent.get(li.category_id) ?? [];
    for (const childId of children) {
      actual += actualsByCategory.get(childId) ?? 0;
    }

    // Variance: for income, positive = good; for expense, budgeted - actual (positive = good)
    const variance =
      categoryType === "income"
        ? actual - li.amount
        : li.amount - actual;

    const variancePercent =
      li.amount > 0 ? (actual / li.amount) * 100 : null;

    return {
      categoryId: li.category_id,
      categoryName: resolveCategoryName(li.category_id),
      categoryType,
      budgeted: li.amount,
      actual,
      variance,
      variancePercent,
    };
  });

  const allIncomeLines = budgetLines.filter((l) => l.categoryType === "income");
  const allExpenseLines = budgetLines.filter(
    (l) => l.categoryType === "expense"
  );

  // Compute unbudgeted actuals first so we can include them in combined matching
  const allUnbudgetedActuals: UnbudgetedActual[] = [];
  for (const [categoryId, actual] of actualsByCategory) {
    if (!budgetedCategoryIds.has(categoryId) && actual > 0) {
      const type = (categoryTypeMap.get(categoryId) ?? "expense") as
        | "income"
        | "expense";
      allUnbudgetedActuals.push({
        categoryId,
        categoryName: resolveCategoryName(categoryId),
        categoryType: type,
        actual,
      });
    }
  }

  // Create synthetic budget lines from unbudgeted actuals for combined matching
  const syntheticNames = new Set<string>();
  const syntheticIncomeLines = allUnbudgetedActuals
    .filter((ua) => ua.categoryType === "income")
    .map((ua) => {
      syntheticNames.add(ua.categoryName);
      return {
        categoryName: ua.categoryName,
        categoryType: ua.categoryType as "income" | "expense",
        budgeted: 0,
        actual: ua.actual,
        variance: ua.actual,
        variancePercent: null,
      };
    });
  const syntheticExpenseLines = allUnbudgetedActuals
    .filter((ua) => ua.categoryType === "expense")
    .map((ua) => {
      syntheticNames.add(ua.categoryName);
      return {
        categoryName: ua.categoryName,
        categoryType: ua.categoryType as "income" | "expense",
        budgeted: 0,
        actual: ua.actual,
        variance: -ua.actual,
        variancePercent: null,
      };
    });

  // Build combined view including unbudgeted actuals that match opposite-type budget lines
  const {
    combinedLines,
    unmatchedIncomeLines,
    unmatchedExpenseLines,
  } = buildCombinedBudgetLines(
    [
      ...allIncomeLines.map((l) => ({
        categoryName: l.categoryName,
        categoryType: l.categoryType,
        budgeted: l.budgeted,
        actual: l.actual,
        variance: l.variance,
        variancePercent: l.variancePercent,
      })),
      ...syntheticIncomeLines,
    ],
    [
      ...allExpenseLines.map((l) => ({
        categoryName: l.categoryName,
        categoryType: l.categoryType,
        budgeted: l.budgeted,
        actual: l.actual,
        variance: l.variance,
        variancePercent: l.variancePercent,
      })),
      ...syntheticExpenseLines,
    ]
  );

  // Separate: budgeted lines → income/expense sections, synthetic → unbudgeted
  const incomeLines = unmatchedIncomeLines.filter(
    (l) => !(l.budgeted === 0 && syntheticNames.has(l.categoryName))
  );
  const expenseLines = unmatchedExpenseLines.filter(
    (l) => !(l.budgeted === 0 && syntheticNames.has(l.categoryName))
  );

  // Only unbudgeted actuals that weren't matched stay in the unbudgeted section
  const matchedCombinedNames = new Set(
    combinedLines.map((cl) => cl.categoryName)
  );
  const unbudgetedActuals = allUnbudgetedActuals.filter(
    (ua) => !matchedCombinedNames.has(ua.categoryName)
  );
  unbudgetedActuals.sort((a, b) => b.actual - a.actual);

  // Summary computations use full arrays (before combining)
  const budgetedIncome = allIncomeLines.reduce((s, l) => s + l.budgeted, 0);
  const actualIncome = allIncomeLines.reduce((s, l) => s + l.actual, 0);
  const budgetedExpenses = allExpenseLines.reduce((s, l) => s + l.budgeted, 0);
  const actualExpenses = allExpenseLines.reduce((s, l) => s + l.actual, 0);
  const netBudget = budgetedIncome - budgetedExpenses;
  const netActual = actualIncome - actualExpenses;

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
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Budgeted Income
              </p>
              <p className="text-lg font-bold tabular-nums text-green-600 dark:text-green-400">
                {formatCurrency(budgetedIncome)}
              </p>
              <p className="text-xs text-muted-foreground">
                Actual: {formatCurrency(actualIncome)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Budgeted Expenses
              </p>
              <p className="text-lg font-bold tabular-nums text-red-600 dark:text-red-400">
                {formatCurrency(budgetedExpenses)}
              </p>
              <p className="text-xs text-muted-foreground">
                Actual: {formatCurrency(actualExpenses)}
              </p>
            </div>
            <div className="rounded-lg border border-border p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Net Budget
              </p>
              <p
                className={`text-lg font-bold tabular-nums ${
                  netBudget >= 0
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {formatCurrency(netBudget)}
              </p>
              <p className="text-xs text-muted-foreground">
                Actual Net: {formatCurrency(netActual)}
              </p>
            </div>
          </div>

          {/* Combined Income & Expense Table */}
          {combinedLines.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Combined Income &amp; Expense
              </h3>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Inc. Budgeted
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Inc. Actual
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Exp. Budgeted
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Exp. Actual
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Net Budgeted
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Net Actual
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {combinedLines.map((line) => (
                      <tr
                        key={line.categoryName}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2">{line.categoryName}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">
                          {formatCurrency(line.incomeBudgeted)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">
                          {formatCurrency(line.incomeActual)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                          {formatCurrency(line.expenseBudgeted)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                          {formatCurrency(line.expenseActual)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <NetCell value={line.netBudgeted} />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <NetCell value={line.netActual} />
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-muted/30 font-medium">
                      <td className="px-3 py-2">Combined Total</td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">
                        {formatCurrency(
                          combinedLines.reduce((s, l) => s + l.incomeBudgeted, 0)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">
                        {formatCurrency(
                          combinedLines.reduce((s, l) => s + l.incomeActual, 0)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                        {formatCurrency(
                          combinedLines.reduce((s, l) => s + l.expenseBudgeted, 0)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                        {formatCurrency(
                          combinedLines.reduce((s, l) => s + l.expenseActual, 0)
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <NetCell
                          value={combinedLines.reduce((s, l) => s + l.netBudgeted, 0)}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <NetCell
                          value={combinedLines.reduce((s, l) => s + l.netActual, 0)}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Income Table */}
          {incomeLines.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Income
              </h3>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Budgeted
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Actual
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Variance
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        %
                      </th>
                      <th className="w-24 px-3 py-2 font-medium text-muted-foreground">
                        Progress
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {incomeLines.map((line) => (
                      <tr
                        key={line.categoryName}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2">{line.categoryName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(line.budgeted)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(line.actual)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <VarianceCell variance={line.variance} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {line.variancePercent !== null
                            ? `${line.variancePercent.toFixed(0)}%`
                            : "\u2014"}
                        </td>
                        <td className="px-3 py-2">
                          <ProgressBar
                            actual={line.actual}
                            budgeted={line.budgeted}
                            type="income"
                          />
                        </td>
                      </tr>
                    ))}
                    {(() => {
                      const subtotalBudgeted = incomeLines.reduce((s, l) => s + l.budgeted, 0);
                      const subtotalActual = incomeLines.reduce((s, l) => s + l.actual, 0);
                      return (
                        <tr className="bg-muted/30 font-medium">
                          <td className="px-3 py-2">Income Subtotal</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrency(subtotalBudgeted)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrency(subtotalActual)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <VarianceCell
                              variance={subtotalActual - subtotalBudgeted}
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {subtotalBudgeted > 0
                              ? `${((subtotalActual / subtotalBudgeted) * 100).toFixed(0)}%`
                              : "\u2014"}
                          </td>
                          <td className="px-3 py-2" />
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Expense Table */}
          {expenseLines.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-3 text-sm font-medium text-muted-foreground">
                Expenses
              </h3>
              <div className="overflow-x-auto rounded-md border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Budgeted
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Actual
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Variance
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        %
                      </th>
                      <th className="w-24 px-3 py-2 font-medium text-muted-foreground">
                        Progress
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {expenseLines.map((line) => (
                      <tr
                        key={line.categoryName}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2">{line.categoryName}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(line.budgeted)}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatCurrency(line.actual)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <VarianceCell variance={line.variance} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                          {line.variancePercent !== null
                            ? `${line.variancePercent.toFixed(0)}%`
                            : "\u2014"}
                        </td>
                        <td className="px-3 py-2">
                          <ProgressBar
                            actual={line.actual}
                            budgeted={line.budgeted}
                            type="expense"
                          />
                        </td>
                      </tr>
                    ))}
                    {(() => {
                      const subtotalBudgeted = expenseLines.reduce((s, l) => s + l.budgeted, 0);
                      const subtotalActual = expenseLines.reduce((s, l) => s + l.actual, 0);
                      return (
                        <tr className="bg-muted/30 font-medium">
                          <td className="px-3 py-2">Expenses Subtotal</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrency(subtotalBudgeted)}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {formatCurrency(subtotalActual)}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <VarianceCell
                              variance={subtotalBudgeted - subtotalActual}
                            />
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                            {subtotalBudgeted > 0
                              ? `${((subtotalActual / subtotalBudgeted) * 100).toFixed(0)}%`
                              : "\u2014"}
                          </td>
                          <td className="px-3 py-2" />
                        </tr>
                      );
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Unbudgeted Actuals */}
          {unbudgetedActuals.length > 0 && (
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
                    <tr className="border-b border-border bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Category
                      </th>
                      <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                        Type
                      </th>
                      <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                        Actual
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {unbudgetedActuals.map((item) => (
                      <tr
                        key={item.categoryId}
                        className="border-b border-border last:border-b-0"
                      >
                        <td className="px-3 py-2">{item.categoryName}</td>
                        <td className="px-3 py-2 capitalize text-muted-foreground">
                          {item.categoryType}
                        </td>
                        <td
                          className={`px-3 py-2 text-right tabular-nums ${
                            item.categoryType === "income"
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {formatCurrency(item.actual)}
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
