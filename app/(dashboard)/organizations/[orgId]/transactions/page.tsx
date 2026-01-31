import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { computeRunningBalances } from "@/lib/balances";
import { Button } from "@/components/ui/button";
import { TransactionFilters } from "./transaction-filters";
import { TransactionTable } from "./transaction-table";

import type { CategoryOption } from "./transaction-filters";

interface SearchParams {
  account_id?: string;
  status?: string;
  category_id?: string;
  start_date?: string;
  end_date?: string;
  sort?: string;
  order?: string;
}

const VALID_SORT_FIELDS = [
  "transaction_date",
  "created_at",
  "amount",
  "description",
  "status",
] as const;

type SortField = (typeof VALID_SORT_FIELDS)[number];

export default async function TransactionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { orgId } = await params;
  const {
    account_id: filterAccountId,
    status: filterStatus,
    category_id: filterCategoryId,
    start_date: filterStartDate,
    end_date: filterEndDate,
    sort: sortParam,
    order: orderParam,
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

  // Fetch active accounts for the filter dropdown
  const { data: accounts } = await supabase
    .from("accounts")
    .select("id, name, opening_balance")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("name");

  const activeAccounts = accounts ?? [];

  // Determine sort field and order
  const sortField: SortField = VALID_SORT_FIELDS.includes(
    sortParam as SortField
  )
    ? (sortParam as SortField)
    : "transaction_date";
  const sortAscending = orderParam === "asc";

  // Build transaction query with filters
  let txnQuery = supabase
    .from("transactions")
    .select(
      `
      *,
      accounts!inner(id, name, organization_id),
      transaction_line_items(
        id,
        amount,
        category_id,
        memo,
        categories(id, name, parent_id, category_type)
      )
    `
    )
    .eq("accounts.organization_id", orgId);

  if (filterAccountId) {
    txnQuery = txnQuery.eq("account_id", filterAccountId);
  }

  if (filterStartDate) {
    txnQuery = txnQuery.gte("transaction_date", filterStartDate);
  }

  if (filterEndDate) {
    txnQuery = txnQuery.lte("transaction_date", filterEndDate);
  }

  if (filterStatus && filterStatus !== "all") {
    const statuses = filterStatus.split(",").filter(Boolean);
    txnQuery = txnQuery.in("status", statuses);
  }

  // Apply sort. For running balance computation we need a separate query path.
  txnQuery = txnQuery.order(sortField, { ascending: sortAscending });
  // Secondary sort for stability
  if (sortField !== "created_at") {
    txnQuery = txnQuery.order("created_at", { ascending: sortAscending });
  }

  const { data: transactions } = await txnQuery;

  // Fetch all categories to resolve parent names and build filter options
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, parent_id, category_type, is_active")
    .eq("organization_id", orgId)
    .order("name");

  const categoryList = allCategories ?? [];
  const categoryNameMap: Record<string, string> = {};
  for (const c of categoryList) {
    categoryNameMap[c.id] = c.name;
  }

  // Build hierarchical category options for filter
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
  // Add active root-less children (orphans)
  const orphans = categoryList.filter(
    (c) =>
      c.parent_id &&
      c.is_active &&
      !parentCategories.some((p) => p.id === c.parent_id)
  );
  for (const orphan of orphans) {
    const parentName = categoryNameMap[orphan.parent_id!] ?? "";
    categoryOptions.push({
      id: orphan.id,
      label: parentName
        ? `${parentName} \u2192 ${orphan.name}`
        : orphan.name,
    });
  }

  let allTransactions = transactions ?? [];

  // Post-fetch category filter: filter transactions where any line item matches
  if (filterCategoryId) {
    allTransactions = allTransactions.filter((txn) => {
      const lineItems = txn.transaction_line_items ?? [];
      return lineItems.some(
        (li: { category_id: string }) => li.category_id === filterCategoryId
      );
    });
  }

  // Compute running balance only when single account AND sorted by transaction_date ascending
  const isSingleAccount = !!filterAccountId;
  const isSortedByDate =
    sortField === "transaction_date" && sortAscending;
  const showRunningBalance = isSingleAccount && isSortedByDate && !filterCategoryId;

  let runningBalanceRecord: Record<string, number> | null = null;

  if (showRunningBalance) {
    // We need all transactions for the account in ascending date order for running balance
    // The current query already has the right order when sortField=transaction_date && ascending
    const selectedAccount = activeAccounts.find(
      (a) => a.id === filterAccountId
    );
    const openingBalance = selectedAccount?.opening_balance ?? 0;
    const balanceMap = computeRunningBalances(openingBalance, allTransactions);
    runningBalanceRecord = {};
    for (const [k, v] of balanceMap.entries()) {
      runningBalanceRecord[k] = v;
    }
  }

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

      <div className="mt-4">
        <TransactionFilters
          accounts={activeAccounts}
          categories={categoryOptions}
        />
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
        <div className="mt-4">
          <TransactionTable
            transactions={allTransactions}
            orgId={orgId}
            categoryNameMap={categoryNameMap}
            runningBalanceMap={runningBalanceRecord}
            showRunningBalance={showRunningBalance}
            currentSort={sortField}
            currentOrder={sortAscending ? "asc" : "desc"}
          />
        </div>
      )}
    </div>
  );
}
