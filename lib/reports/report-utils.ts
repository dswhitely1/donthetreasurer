import type { ReportTransaction, ReportCategorySummary, ReportSummary } from "./types";

export function getNextDay(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().split("T")[0];
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
      return { parentName, children, subtotal };
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

  return {
    totalIncome,
    totalExpenses,
    netChange: totalIncome - totalExpenses,
    balanceByStatus,
    incomeByCategory,
    expensesByCategory,
  };
}
