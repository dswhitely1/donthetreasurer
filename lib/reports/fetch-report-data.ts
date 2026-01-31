import { computeRunningBalances } from "@/lib/balances";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ReportParams } from "@/lib/validations/report";
import type {
  ReportData,
  ReportTransaction,
  ReportLineItem,
  ReportCategorySummary,
  ReportSummary,
} from "./types";

interface RawLineItem {
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
}

interface RawTransaction {
  id: string;
  transaction_date: string;
  created_at: string | null;
  amount: number;
  transaction_type: string;
  description: string;
  check_number: string | null;
  status: string;
  cleared_at: string | null;
  account_id: string;
  accounts: { id: string; name: string; opening_balance: number | null } | null;
  transaction_line_items: RawLineItem[];
}

function getNextDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
}

export async function fetchReportData(
  supabase: SupabaseClient<Database>,
  orgId: string,
  params: ReportParams
): Promise<ReportData> {
  // Fetch organization name
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single();

  if (!org) {
    throw new Error("Organization not found");
  }

  // Fetch all categories for name resolution
  const { data: allCategories } = await supabase
    .from("categories")
    .select("id, name, parent_id, category_type")
    .eq("organization_id", orgId);

  const categoryList = allCategories ?? [];
  const categoryNameMap: Record<string, string> = {};
  const categoryTypeMap: Record<string, string> = {};
  const categoryParentMap: Record<string, string | null> = {};
  for (const c of categoryList) {
    categoryNameMap[c.id] = c.name;
    categoryTypeMap[c.id] = c.category_type;
    categoryParentMap[c.id] = c.parent_id;
  }

  // Build transaction query
  // Report logic: all uncleared transactions are included regardless of date.
  // The date range filters on cleared_at for cleared/reconciled transactions.
  let txnQuery = supabase
    .from("transactions")
    .select(
      `
      *,
      accounts!inner(id, name, opening_balance, organization_id),
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

  if (params.account_id) {
    txnQuery = txnQuery.eq("account_id", params.account_id);
  }

  // Determine which statuses the user wants
  const requestedStatuses = params.status; // undefined = all
  const includeUncleared =
    !requestedStatuses || requestedStatuses.includes("uncleared");
  const clearedStatuses = requestedStatuses
    ? requestedStatuses.filter((s) => s !== "uncleared")
    : ["cleared", "reconciled"];

  // Build OR filter: uncleared (no date restriction) | cleared/reconciled within cleared_at range
  const endDateExclusive = getNextDay(params.end_date);
  const orParts: string[] = [];

  if (includeUncleared) {
    orParts.push("status.eq.uncleared");
  }

  if (clearedStatuses.length > 0) {
    const statusPart =
      clearedStatuses.length === 1
        ? `status.eq.${clearedStatuses[0]}`
        : `status.in.(${clearedStatuses.join(",")})`;
    orParts.push(
      `and(${statusPart},cleared_at.gte.${params.start_date},cleared_at.lt.${endDateExclusive})`
    );
  }

  if (orParts.length > 0) {
    txnQuery = txnQuery.or(orParts.join(","));
  }

  txnQuery = txnQuery
    .order("transaction_date", { ascending: true })
    .order("created_at", { ascending: true });

  const { data: rawTransactions } = await txnQuery;
  let transactions: RawTransaction[] = (rawTransactions as RawTransaction[]) ?? [];

  // Post-fetch category filter
  if (params.category_id) {
    transactions = transactions.filter((txn) =>
      txn.transaction_line_items.some(
        (li) => li.category_id === params.category_id
      )
    );
  }

  // Compute running balance when filtering by a single account
  let runningBalanceMap: Map<string, number> | null = null;
  if (params.account_id && !params.category_id) {
    const account = transactions[0]?.accounts;
    const openingBalance = account?.opening_balance ?? 0;
    runningBalanceMap = computeRunningBalances(openingBalance, transactions.map((t) => ({
      id: t.id,
      amount: t.amount,
      transaction_type: t.transaction_type,
    })));
  }

  // Resolve category label
  function resolveCategoryLabel(categoryId: string): string {
    const name = categoryNameMap[categoryId];
    if (!name) return "Unknown";
    const parentId = categoryParentMap[categoryId];
    if (parentId && categoryNameMap[parentId]) {
      return `${categoryNameMap[parentId]} \u2192 ${name}`;
    }
    return name;
  }

  // Map to report transactions
  const reportTransactions: ReportTransaction[] = transactions.map((txn) => {
    const lineItems: ReportLineItem[] = txn.transaction_line_items.map((li) => ({
      categoryLabel: resolveCategoryLabel(li.category_id),
      amount: li.amount,
      memo: li.memo,
    }));

    return {
      id: txn.id,
      transactionDate: txn.transaction_date,
      createdAt: txn.created_at,
      accountName: txn.accounts?.name ?? "Unknown",
      checkNumber: txn.check_number,
      description: txn.description,
      transactionType: txn.transaction_type as "income" | "expense",
      amount: txn.amount,
      status: txn.status as "uncleared" | "cleared" | "reconciled",
      clearedAt: txn.cleared_at,
      lineItems,
      runningBalance: runningBalanceMap?.get(txn.id) ?? null,
    };
  });

  // Compute summary
  const summary = computeSummary(reportTransactions, categoryNameMap, categoryParentMap);

  return {
    organizationName: org.name,
    startDate: params.start_date,
    endDate: params.end_date,
    generatedAt: new Date().toISOString(),
    transactions: reportTransactions,
    summary,
  };
}

function computeSummary(
  transactions: ReportTransaction[],
  categoryNameMap: Record<string, string>,
  categoryParentMap: Record<string, string | null>
): ReportSummary {
  let totalIncome = 0;
  let totalExpenses = 0;
  const balanceByStatus = { uncleared: 0, cleared: 0, reconciled: 0 };

  // category_id -> amount accumulator, grouped by type
  const incomeByCatId: Record<string, number> = {};
  const expenseByCatId: Record<string, number> = {};

  for (const txn of transactions) {
    if (txn.transactionType === "income") {
      totalIncome += txn.amount;
      balanceByStatus[txn.status] += txn.amount;
    } else {
      totalExpenses += txn.amount;
      balanceByStatus[txn.status] -= txn.amount;
    }

    for (const li of txn.lineItems) {
      // Find category ID from label (reverse lookup)
      const catId = findCategoryId(li.categoryLabel, categoryNameMap, categoryParentMap);
      if (txn.transactionType === "income") {
        incomeByCatId[catId] = (incomeByCatId[catId] ?? 0) + li.amount;
      } else {
        expenseByCatId[catId] = (expenseByCatId[catId] ?? 0) + li.amount;
      }
    }
  }

  const incomeByCategory = buildCategorySummaries(incomeByCatId, categoryNameMap, categoryParentMap);
  const expensesByCategory = buildCategorySummaries(expenseByCatId, categoryNameMap, categoryParentMap);

  return {
    totalIncome,
    totalExpenses,
    netChange: totalIncome - totalExpenses,
    balanceByStatus,
    incomeByCategory,
    expensesByCategory,
  };
}

function findCategoryId(
  label: string,
  categoryNameMap: Record<string, string>,
  categoryParentMap: Record<string, string | null>
): string {
  for (const [id, name] of Object.entries(categoryNameMap)) {
    const parentId = categoryParentMap[id];
    if (parentId && categoryNameMap[parentId]) {
      const fullLabel = `${categoryNameMap[parentId]} \u2192 ${name}`;
      if (fullLabel === label) return id;
    } else if (name === label) {
      return id;
    }
  }
  return "unknown";
}

function buildCategorySummaries(
  amountsByCatId: Record<string, number>,
  categoryNameMap: Record<string, string>,
  categoryParentMap: Record<string, string | null>
): ReportCategorySummary[] {
  // Group by parent
  const parentGroups: Record<string, { children: Record<string, number> }> = {};

  for (const [catId, amount] of Object.entries(amountsByCatId)) {
    const parentId = categoryParentMap[catId];
    const parentName = parentId && categoryNameMap[parentId]
      ? categoryNameMap[parentId]
      : categoryNameMap[catId] ?? "Other";
    const childName = parentId && categoryNameMap[parentId]
      ? categoryNameMap[catId] ?? "Unknown"
      : "(root)";

    if (!parentGroups[parentName]) {
      parentGroups[parentName] = { children: {} };
    }
    parentGroups[parentName].children[childName] =
      (parentGroups[parentName].children[childName] ?? 0) + amount;
  }

  return Object.entries(parentGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([parentName, group]) => {
      const children = Object.entries(group.children)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, total]) => ({ name, total }));
      const subtotal = children.reduce((sum, c) => sum + c.total, 0);
      return { parentName, children, subtotal };
    });
}
