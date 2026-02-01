import { computeRunningBalances } from "@/lib/balances";
import {
  getNextDay,
  resolveCategoryLabel,
  computeSummary,
} from "./report-utils";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { ReportParams } from "@/lib/validations/report";
import type {
  ReportData,
  ReportTransaction,
  ReportLineItem,
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
  vendor: string | null;
  status: string;
  cleared_at: string | null;
  account_id: string;
  accounts: { id: string; name: string; opening_balance: number | null } | null;
  transaction_line_items: RawLineItem[];
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

  // Map to report transactions
  const reportTransactions: ReportTransaction[] = transactions.map((txn) => {
    const lineItems: ReportLineItem[] = txn.transaction_line_items.map((li) => ({
      categoryLabel: resolveCategoryLabel(li.category_id, categoryNameMap, categoryParentMap),
      amount: li.amount,
      memo: li.memo,
    }));

    return {
      id: txn.id,
      transactionDate: txn.transaction_date,
      createdAt: txn.created_at,
      accountName: txn.accounts?.name ?? "Unknown",
      checkNumber: txn.check_number,
      vendor: txn.vendor,
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
