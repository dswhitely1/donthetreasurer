import { notFound } from "next/navigation";
import Link from "next/link";
import {
  Circle,
  CircleCheck,
  FileSpreadsheet,
  FolderTree,
  Landmark,
  Lock,
  PiggyBank,
  Plus,
  Repeat,
  GitBranch,
} from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  RECURRENCE_RULE_LABELS,
} from "@/lib/validations/recurring-template";
import { OrganizationActions } from "./organization-actions";

import type { RecurrenceRule } from "@/lib/recurrence";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function StatusIcon({ status }: Readonly<{ status: string }>) {
  switch (status) {
    case "cleared":
      return <CircleCheck className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
    case "reconciled":
      return <Lock className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />;
    default:
      return <Circle className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />;
  }
}

export default async function OrganizationOverviewPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();

  // Fetch org, accounts, transactions, recent transactions, upcoming templates, and active budgets in parallel
  const [orgResult, accountsResult, txnResult, recentResult, upcomingResult, activeBudgetsResult] =
    await Promise.all([
      supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .eq("is_active", true)
        .single(),
      supabase
        .from("accounts")
        .select("id, name, opening_balance")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("transactions")
        .select(
          "id, amount, transaction_type, status, account_id, accounts!inner(organization_id)"
        )
        .eq("accounts.organization_id", orgId),
      supabase
        .from("transactions")
        .select(
          `
          id,
          transaction_date,
          amount,
          transaction_type,
          description,
          check_number,
          status,
          account_id,
          accounts!inner(id, name, organization_id),
          transaction_line_items(
            id, amount, category_id, memo,
            categories(id, name, parent_id)
          )
        `
        )
        .eq("accounts.organization_id", orgId)
        .order("transaction_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("recurring_templates")
        .select(
          `
          id,
          description,
          amount,
          transaction_type,
          recurrence_rule,
          next_occurrence_date,
          accounts!inner(id, name, organization_id)
        `
        )
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .not("next_occurrence_date", "is", null)
        .order("next_occurrence_date", { ascending: true })
        .limit(5),
      supabase
        .from("budgets")
        .select(
          `
          id,
          name,
          start_date,
          end_date,
          budget_line_items(amount, category_id, categories(category_type))
        `
        )
        .eq("organization_id", orgId)
        .eq("status", "active")
        .order("start_date", { ascending: false })
        .limit(3),
    ]);

  const organization = orgResult.data;
  if (!organization) {
    notFound();
  }

  const accounts = accountsResult.data ?? [];
  const allTransactions = txnResult.data ?? [];
  const recentTransactions = recentResult.data ?? [];
  const upcomingTemplates = upcomingResult.data ?? [];
  const activeBudgets = activeBudgetsResult.data ?? [];

  // Compute balances
  const openingBalanceTotal = accounts.reduce(
    (sum, a) => sum + (a.opening_balance ?? 0),
    0
  );

  let totalIncome = 0;
  let totalExpense = 0;
  const statusNet = { uncleared: 0, cleared: 0, reconciled: 0 };

  for (const txn of allTransactions) {
    const sign = txn.transaction_type === "income" ? 1 : -1;
    const net = txn.amount * sign;

    if (txn.transaction_type === "income") {
      totalIncome += txn.amount;
    } else {
      totalExpense += txn.amount;
    }

    if (txn.status === "uncleared" || txn.status === "cleared" || txn.status === "reconciled") {
      statusNet[txn.status] += net;
    }
  }

  const totalBalance = openingBalanceTotal + totalIncome - totalExpense;

  // Fetch category names for recent transactions
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, parent_id")
    .eq("organization_id", orgId);

  const categoryNameMap: Record<string, string> = {};
  for (const c of allCategories ?? []) {
    categoryNameMap[c.id] = c.name;
  }

  return (
    <TooltipProvider>
      <div>
        {/* Page header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-foreground">
              {organization.name}
            </h2>
            <div className="mt-1 flex items-center gap-2">
              {organization.ein && (
                <span className="text-sm text-muted-foreground">
                  EIN: {organization.ein}
                </span>
              )}
              <Badge variant="secondary" className="text-xs">
                FY starts{" "}
                {MONTH_NAMES[(organization.fiscal_year_start_month ?? 1) - 1]}
              </Badge>
            </div>
          </div>
        </div>

        {/* Summary balance cards */}
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Balance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {formatCurrency(totalBalance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Across {accounts.length} account{accounts.length !== 1 ? "s" : ""}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Circle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" />
                  Uncleared
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {formatCurrency(statusNet.uncleared)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <CircleCheck className="h-3 w-3 text-green-600 dark:text-green-400" />
                  Cleared
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {formatCurrency(statusNet.cleared)}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                  Reconciled
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold tabular-nums text-foreground">
                {formatCurrency(statusNet.reconciled)}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Quick actions */}
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild>
            <Link href={`/organizations/${orgId}/transactions/new`}>
              <Plus className="mr-2 h-4 w-4" />
              Add Transaction
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/organizations/${orgId}/reports`}>
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              View Reports
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/organizations/${orgId}/categories`}>
              <FolderTree className="mr-2 h-4 w-4" />
              Manage Categories
            </Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href={`/organizations/${orgId}/accounts`}>
              <Landmark className="mr-2 h-4 w-4" />
              Manage Accounts
            </Link>
          </Button>
        </div>

        {/* Budget Snapshot */}
        {activeBudgets.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Budget Snapshot
              </h3>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/organizations/${orgId}/budgets`}>
                  View all
                </Link>
              </Button>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeBudgets.map((b) => {
                const items = b.budget_line_items ?? [];
                let budgetedIncome = 0;
                let budgetedExpenses = 0;
                for (const li of items) {
                  const cat = li.categories as { category_type: string } | null;
                  if (cat?.category_type === "income") {
                    budgetedIncome += li.amount;
                  } else {
                    budgetedExpenses += li.amount;
                  }
                }

                return (
                  <Link
                    key={b.id}
                    href={`/organizations/${orgId}/budgets/${b.id}`}
                    className="rounded-lg border border-border p-4 transition-colors hover:bg-muted/30"
                  >
                    <div className="flex items-center gap-2">
                      <PiggyBank className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{b.name}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatDate(b.start_date)} &ndash; {formatDate(b.end_date)}
                    </p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Income
                        </span>
                        <p className="font-medium tabular-nums text-green-600 dark:text-green-400">
                          {formatCurrency(budgetedIncome)}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-muted-foreground">
                          Expenses
                        </span>
                        <p className="font-medium tabular-nums text-red-600 dark:text-red-400">
                          {formatCurrency(budgetedExpenses)}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming recurring transactions */}
        {upcomingTemplates.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-foreground">
                Upcoming Transactions
              </h3>
              <Button variant="ghost" size="sm" asChild>
                <Link href={`/organizations/${orgId}/templates`}>
                  View all
                </Link>
              </Button>
            </div>
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Description
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Account
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Next Date
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Frequency
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {upcomingTemplates.map((tmpl) => {
                    const isIncome = tmpl.transaction_type === "income";
                    const accountName =
                      (tmpl.accounts as { id: string; name: string } | null)
                        ?.name ?? "Unknown";
                    const ruleLabel =
                      RECURRENCE_RULE_LABELS[
                        tmpl.recurrence_rule as RecurrenceRule
                      ] ?? tmpl.recurrence_rule;

                    return (
                      <tr
                        key={tmpl.id}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30"
                      >
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/organizations/${orgId}/templates/${tmpl.id}`}
                            className="inline-flex items-center gap-1.5 font-medium hover:underline"
                          >
                            <Repeat className="h-3.5 w-3.5 text-muted-foreground" />
                            {tmpl.description}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          {accountName}
                        </td>
                        <td
                          className={`px-3 py-2.5 whitespace-nowrap text-right font-medium tabular-nums ${
                            isIncome
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {formatCurrency(tmpl.amount)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          {tmpl.next_occurrence_date
                            ? formatDate(tmpl.next_occurrence_date)
                            : "\u2014"}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          {ruleLabel}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Recent transactions */}
        <div className="mt-8">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">
              Recent Transactions
            </h3>
            <Button variant="ghost" size="sm" asChild>
              <Link href={`/organizations/${orgId}/transactions`}>
                View all
              </Link>
            </Button>
          </div>

          {recentTransactions.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No transactions yet. Record your first transaction to start tracking finances.
              </p>
              <Button asChild className="mt-3" size="sm">
                <Link href={`/organizations/${orgId}/transactions/new`}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Transaction
                </Link>
              </Button>
            </div>
          ) : (
            <div className="mt-3 overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/50">
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Date
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Account
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Description
                    </th>
                    <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">
                      Category
                    </th>
                    <th className="px-3 py-2.5 text-right font-medium text-muted-foreground">
                      Amount
                    </th>
                    <th className="px-3 py-2.5 text-center font-medium text-muted-foreground">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentTransactions.map((txn) => {
                    const lineItems = txn.transaction_line_items ?? [];
                    const isIncome = txn.transaction_type === "income";
                    const accountName =
                      (txn.accounts as { id: string; name: string } | null)
                        ?.name ?? "Unknown";

                    // Build category display
                    let categoryDisplay: string;
                    let isSplit = false;
                    let tooltipLines: string[] = [];

                    if (lineItems.length === 0) {
                      categoryDisplay = "Uncategorized";
                    } else if (lineItems.length === 1) {
                      const cat = lineItems[0].categories as {
                        id: string;
                        name: string;
                        parent_id: string | null;
                      } | null;
                      if (cat?.parent_id) {
                        const parentName =
                          categoryNameMap[cat.parent_id] ?? "";
                        categoryDisplay = parentName
                          ? `${parentName} \u2192 ${cat.name}`
                          : cat.name;
                      } else {
                        categoryDisplay = cat?.name ?? "Unknown";
                      }
                    } else {
                      isSplit = true;
                      categoryDisplay = `Multiple (${lineItems.length})`;
                      tooltipLines = lineItems.map((li) => {
                        const cat = li.categories as {
                          id: string;
                          name: string;
                          parent_id: string | null;
                        } | null;
                        let catName: string;
                        if (cat?.parent_id) {
                          const parentName =
                            categoryNameMap[cat.parent_id] ?? "";
                          catName = parentName
                            ? `${parentName} \u2192 ${cat.name}`
                            : cat.name;
                        } else {
                          catName = cat?.name ?? "Unknown";
                        }
                        return `${catName}: ${formatCurrency(li.amount)}`;
                      });
                    }

                    return (
                      <tr
                        key={txn.id}
                        className="border-b border-border last:border-b-0 hover:bg-muted/30"
                      >
                        <td className="px-3 py-2.5 whitespace-nowrap">
                          {formatDate(txn.transaction_date)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          {accountName}
                        </td>
                        <td className="px-3 py-2.5">
                          <Link
                            href={`/organizations/${orgId}/transactions/${txn.id}`}
                            className="font-medium hover:underline"
                          >
                            {txn.description}
                          </Link>
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap text-muted-foreground">
                          {isSplit ? (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 cursor-default">
                                  <GitBranch className="h-3.5 w-3.5" />
                                  {categoryDisplay}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <div className="space-y-0.5 text-xs">
                                  {tooltipLines.map((line, i) => (
                                    <div key={i}>{line}</div>
                                  ))}
                                </div>
                              </TooltipContent>
                            </Tooltip>
                          ) : (
                            categoryDisplay
                          )}
                        </td>
                        <td
                          className={`px-3 py-2.5 whitespace-nowrap text-right font-medium tabular-nums ${
                            isIncome
                              ? "text-green-600 dark:text-green-400"
                              : "text-red-600 dark:text-red-400"
                          }`}
                        >
                          {isIncome ? "+" : "-"}
                          {formatCurrency(txn.amount)}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="inline-flex">
                                <StatusIcon status={txn.status} />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <span className="capitalize">{txn.status}</span>
                            </TooltipContent>
                          </Tooltip>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Organization settings */}
        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Organization Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="font-medium text-muted-foreground">Created</dt>
                  <dd className="mt-1 text-foreground">
                    {organization.created_at
                      ? new Date(organization.created_at).toLocaleDateString()
                      : "N/A"}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-muted-foreground">
                    Last Updated
                  </dt>
                  <dd className="mt-1 text-foreground">
                    {organization.updated_at
                      ? new Date(organization.updated_at).toLocaleDateString()
                      : "N/A"}
                  </dd>
                </div>
              </dl>
              <OrganizationActions organization={organization} />
            </CardContent>
          </Card>
        </div>
      </div>
    </TooltipProvider>
  );
}
