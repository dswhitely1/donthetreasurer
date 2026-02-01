import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Plus } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { computeRunningBalances } from "@/lib/balances";
import { Button } from "@/components/ui/button";
import { Pagination } from "@/components/ui/pagination";
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
  page?: string;
  limit?: string;
}

const VALID_SORT_FIELDS = [
  "transaction_date",
  "created_at",
  "amount",
  "description",
  "status",
] as const;

type SortField = (typeof VALID_SORT_FIELDS)[number];

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

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
    page: pageParam,
    limit: limitParam,
  } = await searchParams;

  const supabase = await createClient();

  // Parse pagination params
  const page = Math.max(1, Math.floor(Number(pageParam) || 1));
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Math.floor(Number(limitParam) || DEFAULT_LIMIT))
  );
  const from = (page - 1) * limit;
  const to = from + limit - 1;

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

  // Shared select shape for transaction queries
  const txnSelectShape = `
    *,
    accounts!inner(id, name, organization_id),
    transaction_line_items(
      id,
      amount,
      category_id,
      memo,
      categories(id, name, parent_id, category_type)
    )
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function applyFiltersAndSort(query: any) {
    let q = query;
    if (filterAccountId) {
      q = q.eq("account_id", filterAccountId);
    }
    if (filterStartDate) {
      q = q.gte("transaction_date", filterStartDate);
    }
    if (filterEndDate) {
      q = q.lte("transaction_date", filterEndDate);
    }
    if (filterStatus && filterStatus !== "all") {
      const statuses = filterStatus.split(",").filter(Boolean);
      q = q.in("status", statuses);
    }
    q = q.order(sortField, { ascending: sortAscending });
    if (sortField !== "created_at") {
      q = q.order("created_at", { ascending: sortAscending });
    }
    return q;
  }

  let allTransactions: Array<{
    id: string;
    transaction_date: string;
    created_at: string | null;
    amount: number;
    transaction_type: string;
    description: string;
    check_number: string | null;
    vendor: string | null;
    status: string;
    cleared_at: string | null;
    account_id: string;
    accounts: { id: string; name: string; organization_id: string } | null;
    transaction_line_items: Array<{
      id: string;
      amount: number;
      category_id: string;
      memo: string | null;
      categories: {
        id: string;
        name: string;
        parent_id: string | null;
        category_type: string;
      } | null;
    }>;
  }> = [];
  let totalCount = 0;

  if (filterCategoryId) {
    // Category filter path: fetch all, filter in memory, then slice
    const txnQuery = applyFiltersAndSort(
      supabase
        .from("transactions")
        .select(txnSelectShape)
        .eq("accounts.organization_id", orgId)
    );

    const { data: transactions } = await txnQuery;
    const filtered = (transactions ?? []).filter((txn: { transaction_line_items?: Array<{ category_id: string }> }) => {
      const lineItems = txn.transaction_line_items ?? [];
      return lineItems.some(
        (li) => li.category_id === filterCategoryId
      );
    });

    totalCount = filtered.length;
    allTransactions = filtered.slice(from, from + limit);
  } else {
    // Standard path: use DB-level pagination with count
    const txnQuery = applyFiltersAndSort(
      supabase
        .from("transactions")
        .select(txnSelectShape, { count: "exact" })
        .eq("accounts.organization_id", orgId)
    ).range(from, to);

    const { data: transactions, count } = await txnQuery;
    allTransactions = transactions ?? [];
    totalCount = count ?? 0;
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / limit));

  // Boundary redirect: if page exceeds total pages, redirect to last valid page
  if (page > totalPages && totalCount > 0) {
    const redirectParams = new URLSearchParams();
    if (filterAccountId) redirectParams.set("account_id", filterAccountId);
    if (filterStatus) redirectParams.set("status", filterStatus);
    if (filterCategoryId) redirectParams.set("category_id", filterCategoryId);
    if (filterStartDate) redirectParams.set("start_date", filterStartDate);
    if (filterEndDate) redirectParams.set("end_date", filterEndDate);
    if (sortParam) redirectParams.set("sort", sortParam);
    if (orderParam) redirectParams.set("order", orderParam);
    if (limit !== DEFAULT_LIMIT) redirectParams.set("limit", String(limit));
    if (totalPages > 1) redirectParams.set("page", String(totalPages));
    const qs = redirectParams.toString();
    redirect(
      `/organizations/${orgId}/transactions${qs ? `?${qs}` : ""}`
    );
  }

  // Compute running balance only when single account AND sorted by transaction_date ascending AND no category filter
  const isSingleAccount = !!filterAccountId;
  const isSortedByDate =
    sortField === "transaction_date" && sortAscending;
  const showRunningBalance = isSingleAccount && isSortedByDate && !filterCategoryId;

  let runningBalanceRecord: Record<string, number> | null = null;

  if (showRunningBalance) {
    const selectedAccount = activeAccounts.find(
      (a) => a.id === filterAccountId
    );
    const openingBalance = selectedAccount?.opening_balance ?? 0;

    if (page > 1) {
      // Fetch prior transactions to compute cumulative starting balance
      let priorQuery = supabase
        .from("transactions")
        .select("id, amount, transaction_type")
        .eq("account_id", filterAccountId!);

      if (filterStartDate) {
        priorQuery = priorQuery.gte("transaction_date", filterStartDate);
      }
      if (filterEndDate) {
        priorQuery = priorQuery.lte("transaction_date", filterEndDate);
      }
      if (filterStatus && filterStatus !== "all") {
        const statuses = filterStatus.split(",").filter(Boolean);
        priorQuery = priorQuery.in("status", statuses);
      }

      priorQuery = priorQuery
        .order("transaction_date", { ascending: true })
        .order("created_at", { ascending: true })
        .range(0, from - 1);

      const { data: priorTxns } = await priorQuery;

      // Sum prior transactions to get starting balance for this page
      let startingBalance = openingBalance;
      for (const txn of priorTxns ?? []) {
        if (txn.transaction_type === "income") {
          startingBalance += txn.amount;
        } else {
          startingBalance -= txn.amount;
        }
      }

      const balanceMap = computeRunningBalances(startingBalance, allTransactions);
      runningBalanceRecord = {};
      for (const [k, v] of balanceMap.entries()) {
        runningBalanceRecord[k] = v;
      }
    } else {
      const balanceMap = computeRunningBalances(openingBalance, allTransactions);
      runningBalanceRecord = {};
      for (const [k, v] of balanceMap.entries()) {
        runningBalanceRecord[k] = v;
      }
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

      {totalCount === 0 ? (
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
            accounts={activeAccounts.map((a) => ({ id: a.id, name: a.name }))}
          />
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalCount={totalCount}
            limit={limit}
          />
        </div>
      )}
    </div>
  );
}
