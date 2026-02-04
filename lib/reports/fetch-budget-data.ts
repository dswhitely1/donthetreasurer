import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import type { BudgetStatus } from "@/lib/validations/budget";

import { buildCombinedBudgetLines } from "./budget-combined";

import type { CombinedBudgetLine } from "./budget-combined";

export interface BudgetReportLine {
  categoryName: string;
  categoryType: "income" | "expense";
  budgeted: number;
  actual: number;
  variance: number;
  variancePercent: number | null;
}

export interface UnbudgetedActualLine {
  categoryName: string;
  categoryType: "income" | "expense";
  actual: number;
}

export interface BudgetReportData {
  budgetName: string;
  startDate: string;
  endDate: string;
  status: BudgetStatus;
  incomeLines: BudgetReportLine[];
  expenseLines: BudgetReportLine[];
  combinedLines: CombinedBudgetLine[];
  unbudgetedActuals: UnbudgetedActualLine[];
  totals: {
    budgetedIncome: number;
    actualIncome: number;
    budgetedExpenses: number;
    actualExpenses: number;
    netBudget: number;
    netActual: number;
  };
}

export async function fetchBudgetReportData(
  supabase: SupabaseClient<Database>,
  budgetId: string
): Promise<BudgetReportData | null> {
  // Fetch budget with line items
  const { data: budget, error: budgetError } = await supabase
    .from("budgets")
    .select(
      `
      *,
      budget_line_items(
        id, amount, category_id,
        categories(id, name, category_type, parent_id)
      )
    `
    )
    .eq("id", budgetId)
    .single();

  if (budgetError && budgetError.code !== "PGRST116") {
    throw new Error(`Failed to fetch budget: ${budgetError.message}`);
  }

  if (!budget) return null;

  const orgId = budget.organization_id;

  // Fetch all categories for parent name resolution
  const { data: allCategories, error: categoriesError } = await supabase
    .from("categories")
    .select("id, name, category_type, parent_id")
    .eq("organization_id", orgId);

  if (categoriesError) {
    throw new Error(`Failed to fetch categories: ${categoriesError.message}`);
  }

  const categoryNameMap = new Map(
    (allCategories ?? []).map((c) => [c.id, c.name])
  );
  const childrenByParent = new Map<string, string[]>();
  for (const cat of allCategories ?? []) {
    if (cat.parent_id) {
      const existing = childrenByParent.get(cat.parent_id) ?? [];
      existing.push(cat.id);
      childrenByParent.set(cat.parent_id, existing);
    }
  }

  function resolveName(categoryId: string): string {
    const cat = (allCategories ?? []).find((c) => c.id === categoryId);
    if (!cat) return "Unknown";
    if (cat.parent_id) {
      const parentName = categoryNameMap.get(cat.parent_id) ?? "";
      return parentName ? `${parentName} \u2192 ${cat.name}` : cat.name;
    }
    return cat.name;
  }

  // Fetch actuals
  const { data: transactions, error: transactionsError } = await supabase
    .from("transactions")
    .select(
      `
      id,
      accounts!inner(organization_id),
      transaction_line_items(category_id, amount)
    `
    )
    .eq("accounts.organization_id", orgId)
    .gte("transaction_date", budget.start_date)
    .lte("transaction_date", budget.end_date);

  if (transactionsError) {
    throw new Error(`Failed to fetch transactions: ${transactionsError.message}`);
  }

  const actualsByCategory = new Map<string, number>();
  for (const txn of transactions ?? []) {
    for (const li of txn.transaction_line_items ?? []) {
      const current = actualsByCategory.get(li.category_id) ?? 0;
      actualsByCategory.set(li.category_id, current + li.amount);
    }
  }

  const lineItems = budget.budget_line_items ?? [];
  const incomeLines: BudgetReportLine[] = [];
  const expenseLines: BudgetReportLine[] = [];

  for (const li of lineItems) {
    const cat = li.categories as {
      id: string;
      name: string;
      category_type: string;
      parent_id: string | null;
    } | null;

    const categoryType = (cat?.category_type ?? "expense") as
      | "income"
      | "expense";

    let actual = actualsByCategory.get(li.category_id) ?? 0;
    const children = childrenByParent.get(li.category_id) ?? [];
    for (const childId of children) {
      actual += actualsByCategory.get(childId) ?? 0;
    }

    const variance =
      categoryType === "income"
        ? actual - li.amount
        : li.amount - actual;

    const variancePercent =
      li.amount > 0 ? (actual / li.amount) * 100 : null;

    const line: BudgetReportLine = {
      categoryName: resolveName(li.category_id),
      categoryType,
      budgeted: li.amount,
      actual,
      variance,
      variancePercent,
    };

    if (categoryType === "income") {
      incomeLines.push(line);
    } else {
      expenseLines.push(line);
    }
  }

  // Totals computed from full budgeted arrays (before combining with unbudgeted)
  const budgetedIncome = incomeLines.reduce((s, l) => s + l.budgeted, 0);
  const actualIncome = incomeLines.reduce((s, l) => s + l.actual, 0);
  const budgetedExpenses = expenseLines.reduce((s, l) => s + l.budgeted, 0);
  const actualExpenses = expenseLines.reduce((s, l) => s + l.actual, 0);

  // Build set of budgeted category IDs (including children of parent categories)
  const budgetedCategoryIds = new Set<string>();
  for (const li of lineItems) {
    budgetedCategoryIds.add(li.category_id);
    const children = childrenByParent.get(li.category_id) ?? [];
    for (const childId of children) {
      budgetedCategoryIds.add(childId);
    }
  }

  // Compute unbudgeted actuals
  const categoryTypeMap = new Map(
    (allCategories ?? []).map((c) => [c.id, c.category_type])
  );
  const allUnbudgetedActuals: UnbudgetedActualLine[] = [];
  for (const [categoryId, actual] of actualsByCategory) {
    if (!budgetedCategoryIds.has(categoryId) && actual > 0) {
      allUnbudgetedActuals.push({
        categoryName: resolveName(categoryId),
        categoryType: (categoryTypeMap.get(categoryId) ?? "expense") as
          | "income"
          | "expense",
        actual,
      });
    }
  }

  // Create synthetic budget lines from unbudgeted actuals for combined matching
  const syntheticNames = new Set<string>();
  const syntheticIncome: BudgetReportLine[] = [];
  const syntheticExpense: BudgetReportLine[] = [];
  for (const ua of allUnbudgetedActuals) {
    syntheticNames.add(ua.categoryName);
    const line: BudgetReportLine = {
      categoryName: ua.categoryName,
      categoryType: ua.categoryType,
      budgeted: 0,
      actual: ua.actual,
      variance: ua.categoryType === "income" ? ua.actual : -ua.actual,
      variancePercent: null,
    };
    if (ua.categoryType === "income") {
      syntheticIncome.push(line);
    } else {
      syntheticExpense.push(line);
    }
  }

  // Merge budgeted and synthetic lines, then split into combined + unmatched
  const {
    combinedLines,
    unmatchedIncomeLines,
    unmatchedExpenseLines,
  } = buildCombinedBudgetLines(
    [...incomeLines, ...syntheticIncome],
    [...expenseLines, ...syntheticExpense]
  );

  // Separate unmatched: budgeted lines stay in sections, synthetic go to unbudgeted
  const matchedCombinedNames = new Set(
    combinedLines.map((cl) => cl.categoryName)
  );
  const unbudgetedActuals = allUnbudgetedActuals.filter(
    (ua) => !matchedCombinedNames.has(ua.categoryName)
  );

  return {
    budgetName: budget.name,
    startDate: budget.start_date,
    endDate: budget.end_date,
    status: budget.status as BudgetStatus,
    incomeLines: unmatchedIncomeLines.filter(
      (l) => !(l.budgeted === 0 && syntheticNames.has(l.categoryName))
    ),
    expenseLines: unmatchedExpenseLines.filter(
      (l) => !(l.budgeted === 0 && syntheticNames.has(l.categoryName))
    ),
    combinedLines,
    unbudgetedActuals,
    totals: {
      budgetedIncome,
      actualIncome,
      budgetedExpenses,
      actualExpenses,
      netBudget: budgetedIncome - budgetedExpenses,
      netActual: actualIncome - actualExpenses,
    },
  };
}
