import { addDays, format } from "date-fns";

import type { ReportTransaction, ReportCategorySummary, ReportSummary, MergedCategorySummary, CategoryNetSummary, CategoryNetSummaryChild } from "./types";

export function getNextDay(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  return format(addDays(new Date(y, m - 1, d), 1), "yyyy-MM-dd");
}

export function resolveCategoryLabel(
  categoryId: string,
  categoryNameMap: Record<string, string>,
  categoryParentMap: Record<string, string | null>
): string {
  const name = categoryNameMap[categoryId];
  if (!name) return "Unknown";
  const parentId = categoryParentMap[categoryId];
  if (parentId && categoryNameMap[parentId]) {
    return `${categoryNameMap[parentId]} \u2192 ${name}`;
  }
  return name;
}

export function findCategoryId(
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

export function buildCategorySummaries(
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

      // Collapse: if the only child is "(root)", show as flat parent row
      if (children.length === 1 && children[0].name === "(root)") {
        return { parentName, children: [], subtotal };
      }

      return { parentName, children, subtotal };
    });
}

export function buildCategoryNetSummaries(
  inByCatId: Record<string, number>,
  outByCatId: Record<string, number>,
  categoryNameMap: Record<string, string>,
  categoryParentMap: Record<string, string | null>
): CategoryNetSummary[] {
  const parentGroups: Record<
    string,
    Record<string, { in: number; out: number }>
  > = {};

  function slot(catId: string): { in: number; out: number } {
    const parentId = categoryParentMap[catId];
    const hasParent = Boolean(parentId && categoryNameMap[parentId]);
    const parentName = hasParent
      ? categoryNameMap[parentId as string]
      : categoryNameMap[catId] ?? "Other";
    const childName = hasParent ? categoryNameMap[catId] ?? "Unknown" : "(root)";

    parentGroups[parentName] ??= {};
    parentGroups[parentName][childName] ??= { in: 0, out: 0 };
    return parentGroups[parentName][childName];
  }

  for (const [catId, amount] of Object.entries(inByCatId)) {
    slot(catId).in += amount;
  }
  for (const [catId, amount] of Object.entries(outByCatId)) {
    slot(catId).out += amount;
  }

  return Object.entries(parentGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([parentName, childMap]) => {
      const children: CategoryNetSummaryChild[] = Object.entries(childMap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, v]) => ({ name, in: v.in, out: v.out, net: v.in - v.out }));

      const totalIn = children.reduce((s, c) => s + c.in, 0);
      const totalOut = children.reduce((s, c) => s + c.out, 0);

      const collapsed =
        children.length === 1 && children[0].name === "(root)" ? [] : children;

      return { parentName, children: collapsed, totalIn, totalOut, net: totalIn - totalOut };
    });
}

export function computeSummary(
  transactions: ReportTransaction[],
  categoryNameMap: Record<string, string>,
  categoryParentMap: Record<string, string | null>
): ReportSummary {
  let totalIncome = 0;
  let totalExpenses = 0;
  const balanceByStatus = { uncleared: 0, cleared: 0, reconciled: 0 };

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

  // Detect parent names present in both income and expense
  const incomeParentNames = new Set(incomeByCategory.map((g) => g.parentName));
  const expenseParentNames = new Set(expensesByCategory.map((g) => g.parentName));
  const mergedParentNames = new Set(
    [...incomeParentNames].filter((name) => expenseParentNames.has(name))
  );

  // Build merged categories and filter originals
  const netByCategory: MergedCategorySummary[] = [];

  if (mergedParentNames.size > 0) {
    const incomeByParent = new Map(incomeByCategory.map((g) => [g.parentName, g]));
    const expenseByParent = new Map(expensesByCategory.map((g) => [g.parentName, g]));

    for (const parentName of [...mergedParentNames].sort()) {
      const incomeGroup = incomeByParent.get(parentName)!;
      const expenseGroup = expenseByParent.get(parentName)!;

      netByCategory.push({
        parentName,
        incomeChildren: incomeGroup.children,
        expenseChildren: expenseGroup.children,
        totalIncome: incomeGroup.subtotal,
        totalExpenses: expenseGroup.subtotal,
        net: incomeGroup.subtotal - expenseGroup.subtotal,
      });
    }
  }

  const filteredIncome = incomeByCategory.filter((g) => !mergedParentNames.has(g.parentName));
  const filteredExpenses = expensesByCategory.filter((g) => !mergedParentNames.has(g.parentName));

  return {
    totalIncome,
    totalExpenses,
    netChange: totalIncome - totalExpenses,
    balanceByStatus,
    incomeByCategory: filteredIncome,
    expensesByCategory: filteredExpenses,
    netByCategory,
  };
}
