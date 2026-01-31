import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { reportParamsSchema } from "@/lib/validations/report";
import { fetchReportData } from "@/lib/reports/fetch-report-data";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ReportFilters } from "./report-filters";

import type { CategoryOption } from "./report-filters";

interface SearchParams {
  account_id?: string;
  status?: string;
  category_id?: string;
  start_date?: string;
  end_date?: string;
}

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgId } = await params;
  const {
    account_id,
    status,
    category_id,
    start_date,
    end_date,
  } = await searchParams;

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

  // Fetch active accounts for filter dropdown
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  const activeAccounts = accounts ?? [];

  // Fetch all categories for filter dropdown
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, parent_id, is_active")
    .eq("organization_id", orgId)
    .order("name");

  const categoryList = allCategories ?? [];
  const categoryNameMap: Record<string, string> = {};
  for (const c of categoryList) {
    categoryNameMap[c.id] = c.name;
  }

  const categoryOptions: CategoryOption[] = [];
  const parentCategories = categoryList.filter(
    (c) => !c.parent_id && c.is_active
  );
  for (const parent of parentCategories) {
    categoryOptions.push({ id: parent.id, label: parent.name });
    const children = categoryList.filter(
      (c) => c.parent_id === parent.id && c.is_active
    );
    for (const child of children) {
      categoryOptions.push({
        id: child.id,
        label: `${parent.name} \u2192 ${child.name}`,
      });
    }
  }

  // Check if we have valid date range to generate report
  const hasDateRange = !!start_date && !!end_date;
  let reportData = null;
  let reportError: string | null = null;

  if (hasDateRange) {
    const parsed = reportParamsSchema.safeParse({
      start_date,
      end_date,
      account_id: account_id || undefined,
      category_id: category_id || undefined,
      status: status || undefined,
    });

    if (!parsed.success) {
      reportError = "Invalid report parameters. Please check your date range.";
    } else {
      try {
        reportData = await fetchReportData(supabase, orgId, parsed.data);
      } catch {
        reportError = "Failed to load report data.";
      }
    }
  }

  return (
    <div>
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Reports
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Generate and export transaction reports for {organization.name}.
          All uncleared transactions are always included. The date range
          filters cleared and reconciled transactions by their cleared date.
        </p>
      </div>

      <div className="mt-4">
        <ReportFilters
          orgId={orgId}
          accounts={activeAccounts}
          categories={categoryOptions}
        />
      </div>

      {!hasDateRange && (
        <div className="mt-12 flex flex-col items-center justify-center rounded-lg border border-dashed border-border p-12 text-center">
          <h3 className="text-lg font-semibold text-foreground">
            Select a cleared date range
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a cleared-from and cleared-to date above to preview your
            report. All uncleared transactions will be included automatically.
          </p>
        </div>
      )}

      {reportError && (
        <div className="mt-6 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
          {reportError}
        </div>
      )}

      {reportData && (
        <div className="mt-6 space-y-6">
          {/* Summary cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Income
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {formatCurrency(reportData.summary.totalIncome)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Expenses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(reportData.summary.totalExpenses)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Net Change
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-bold ${
                    reportData.summary.netChange >= 0
                      ? "text-green-600 dark:text-green-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {formatCurrency(reportData.summary.netChange)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-foreground">
                  {reportData.transactions.length}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Balance by Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Balance by Status</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-2 sm:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Uncleared</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatCurrency(reportData.summary.balanceByStatus.uncleared)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Cleared</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatCurrency(reportData.summary.balanceByStatus.cleared)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Reconciled</dt>
                  <dd className="text-lg font-semibold tabular-nums">
                    {formatCurrency(reportData.summary.balanceByStatus.reconciled)}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          {/* Category breakdowns */}
          <div className="grid gap-4 lg:grid-cols-2">
            {reportData.summary.incomeByCategory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Income by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reportData.summary.incomeByCategory.map((group) => (
                      <div key={group.parentName}>
                        <p className="font-medium text-sm">{group.parentName}</p>
                        <div className="ml-4 mt-1 space-y-0.5">
                          {group.children.map((child) => (
                            <div
                              key={child.name}
                              className="flex justify-between text-sm text-muted-foreground"
                            >
                              <span>{child.name}</span>
                              <span className="tabular-nums">
                                {formatCurrency(child.total)}
                              </span>
                            </div>
                          ))}
                          {group.children.length > 1 && (
                            <div className="flex justify-between text-sm font-medium border-t border-border pt-1 mt-1">
                              <span>Subtotal</span>
                              <span className="tabular-nums">
                                {formatCurrency(group.subtotal)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {reportData.summary.expensesByCategory.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Expenses by Category</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {reportData.summary.expensesByCategory.map((group) => (
                      <div key={group.parentName}>
                        <p className="font-medium text-sm">{group.parentName}</p>
                        <div className="ml-4 mt-1 space-y-0.5">
                          {group.children.map((child) => (
                            <div
                              key={child.name}
                              className="flex justify-between text-sm text-muted-foreground"
                            >
                              <span>{child.name}</span>
                              <span className="tabular-nums">
                                {formatCurrency(child.total)}
                              </span>
                            </div>
                          ))}
                          {group.children.length > 1 && (
                            <div className="flex justify-between text-sm font-medium border-t border-border pt-1 mt-1">
                              <span>Subtotal</span>
                              <span className="tabular-nums">
                                {formatCurrency(group.subtotal)}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Transaction preview table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Transaction Details</CardTitle>
            </CardHeader>
            <CardContent>
              {reportData.transactions.length === 0 ? (
                <p className="text-sm text-muted-foreground italic">
                  No transactions found matching these filters.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/50">
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Txn Date
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Account
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Check #
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Description
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Category
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Memo
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          Income
                        </th>
                        <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                          Expense
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Status
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                          Cleared
                        </th>
                        {reportData.transactions.some(
                          (t) => t.runningBalance !== null
                        ) && (
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                            Balance
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.transactions.flatMap((txn) => {
                        const showBalance = reportData!.transactions.some(
                          (t) => t.runningBalance !== null
                        );
                        return txn.lineItems.map((li, idx) => {
                          const isFirst = idx === 0;
                          const isLast = idx === txn.lineItems.length - 1;
                          return (
                            <tr
                              key={`${txn.id}-${idx}`}
                              className="border-b border-border last:border-b-0"
                            >
                              <td className="px-3 py-2 whitespace-nowrap">
                                {isFirst
                                  ? formatDate(txn.transactionDate)
                                  : ""}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {isFirst ? txn.accountName : ""}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {isFirst
                                  ? txn.checkNumber ?? ""
                                  : ""}
                              </td>
                              <td className="px-3 py-2">
                                {isFirst ? txn.description : ""}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap">
                                {li.categoryLabel}
                              </td>
                              <td className="px-3 py-2 text-muted-foreground">
                                {li.memo ?? ""}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-green-600 dark:text-green-400">
                                {txn.transactionType === "income"
                                  ? formatCurrency(li.amount)
                                  : ""}
                              </td>
                              <td className="px-3 py-2 text-right tabular-nums text-red-600 dark:text-red-400">
                                {txn.transactionType === "expense"
                                  ? formatCurrency(li.amount)
                                  : ""}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap capitalize">
                                {isFirst ? txn.status : ""}
                              </td>
                              <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                {isFirst && txn.clearedAt
                                  ? formatDateTime(txn.clearedAt)
                                  : ""}
                              </td>
                              {showBalance && (
                                <td className="px-3 py-2 text-right tabular-nums font-medium">
                                  {isLast && txn.runningBalance !== null
                                    ? formatCurrency(txn.runningBalance)
                                    : ""}
                                </td>
                              )}
                            </tr>
                          );
                        });
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
