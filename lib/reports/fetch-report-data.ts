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
  AccountBalanceSummary,
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
  // Uncleared transactions: included if transaction_date <= report end date.
  // Cleared/reconciled: filtered by cleared_at within the report date range.
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

  // Build OR filter:
  //   uncleared — transaction_date on or before the report end date
  //   cleared/reconciled — filtered by cleared_at within the report period
  const endDateExclusive = getNextDay(params.end_date);
  const orParts: string[] = [];

  if (includeUncleared) {
    orParts.push(
      `and(status.eq.uncleared,transaction_date.lt.${endDateExclusive})`
    );
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

    // Fetch pre-period cleared/reconciled transactions to compute the true
    // starting balance at the beginning of the report date range
    const { data: prePeriodForRunning } = await supabase
      .from("transactions")
      .select("amount, transaction_type")
      .eq("account_id", params.account_id)
      .in("status", ["cleared", "reconciled"])
      .lt("cleared_at", params.start_date);

    let prePeriodNet = 0;
    for (const txn of prePeriodForRunning ?? []) {
      prePeriodNet += txn.transaction_type === "income" ? txn.amount : -txn.amount;
    }

    const startingBalance = openingBalance + prePeriodNet;
    runningBalanceMap = computeRunningBalances(startingBalance, transactions.map((t) => ({
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

  // Compute account balances (only when not filtering by category)
  let accountBalances: AccountBalanceSummary[] | null = null;
  if (!params.category_id) {
    // Collect unique accounts from the report transactions
    const accountIds = new Set<string>();
    const accountNameById = new Map<string, string>();
    const accountOpeningBalance = new Map<string, number>();
    for (const txn of transactions) {
      accountIds.add(txn.account_id);
      if (txn.accounts) {
        accountNameById.set(txn.account_id, txn.accounts.name);
        accountOpeningBalance.set(txn.account_id, txn.accounts.opening_balance ?? 0);
      }
    }

    // Also include the filtered account even if it has no transactions in the report
    if (params.account_id && !accountIds.has(params.account_id)) {
      const { data: acct } = await supabase
        .from("accounts")
        .select("id, name, opening_balance")
        .eq("id", params.account_id)
        .single();
      if (acct) {
        accountIds.add(acct.id);
        accountNameById.set(acct.id, acct.name);
        accountOpeningBalance.set(acct.id, acct.opening_balance ?? 0);
      }
    }

    if (accountIds.size > 0) {
      // Query pre-period cleared/reconciled transactions for starting balance
      const { data: prePeriodTxns } = await supabase
        .from("transactions")
        .select("account_id, amount, transaction_type")
        .in("account_id", Array.from(accountIds))
        .in("status", ["cleared", "reconciled"])
        .lt("cleared_at", params.start_date);

      // Compute starting balances: opening_balance + net of pre-period cleared/reconciled
      const prePeriodNet = new Map<string, number>();
      for (const txn of prePeriodTxns ?? []) {
        const current = prePeriodNet.get(txn.account_id) ?? 0;
        const net = txn.transaction_type === "income" ? txn.amount : -txn.amount;
        prePeriodNet.set(txn.account_id, current + net);
      }

      // Compute report-period net per account from the report transactions
      const reportNet = new Map<string, number>();
      for (const txn of reportTransactions) {
        const acctId = transactions.find((t) => t.id === txn.id)?.account_id;
        if (!acctId) continue;
        const current = reportNet.get(acctId) ?? 0;
        const net = txn.transactionType === "income" ? txn.amount : -txn.amount;
        reportNet.set(acctId, current + net);
      }

      accountBalances = Array.from(accountIds).map((acctId) => {
        const opening = accountOpeningBalance.get(acctId) ?? 0;
        const prePeriod = prePeriodNet.get(acctId) ?? 0;
        const startingBalance = opening + prePeriod;
        const periodNet = reportNet.get(acctId) ?? 0;
        return {
          accountName: accountNameById.get(acctId) ?? "Unknown",
          startingBalance,
          endingBalance: startingBalance + periodNet,
        };
      });
    }
  }

  // Compute summary
  const summary = computeSummary(reportTransactions, categoryNameMap, categoryParentMap);

  return {
    organizationName: org.name,
    startDate: params.start_date,
    endDate: params.end_date,
    generatedAt: new Date().toISOString(),
    transactions: reportTransactions,
    summary,
    accountBalances,
  };
}
