import type { BudgetReportLine } from "./fetch-budget-data";

export interface CombinedBudgetLine {
  categoryName: string;
  incomeBudgeted: number;
  incomeActual: number;
  expenseBudgeted: number;
  expenseActual: number;
  netBudgeted: number;
  netActual: number;
}

export interface CombinedBudgetResult {
  combinedLines: CombinedBudgetLine[];
  unmatchedIncomeLines: BudgetReportLine[];
  unmatchedExpenseLines: BudgetReportLine[];
}

/**
 * Match income and expense budget lines by resolved display name.
 * When the same category name appears in both income and expense,
 * produce a combined row showing income - expense = net.
 * Duplicate names within the same type are summed before matching.
 */
export function buildCombinedBudgetLines(
  incomeLines: readonly BudgetReportLine[],
  expenseLines: readonly BudgetReportLine[]
): CombinedBudgetResult {
  // Group by categoryName, summing duplicates within each type
  const incomeMap = new Map<string, { budgeted: number; actual: number }>();
  for (const line of incomeLines) {
    const existing = incomeMap.get(line.categoryName);
    if (existing) {
      existing.budgeted += line.budgeted;
      existing.actual += line.actual;
    } else {
      incomeMap.set(line.categoryName, {
        budgeted: line.budgeted,
        actual: line.actual,
      });
    }
  }

  const expenseMap = new Map<string, { budgeted: number; actual: number }>();
  for (const line of expenseLines) {
    const existing = expenseMap.get(line.categoryName);
    if (existing) {
      existing.budgeted += line.budgeted;
      existing.actual += line.actual;
    } else {
      expenseMap.set(line.categoryName, {
        budgeted: line.budgeted,
        actual: line.actual,
      });
    }
  }

  // Find names present in both maps
  const combinedLines: CombinedBudgetLine[] = [];
  const matchedNames = new Set<string>();

  for (const [name, income] of incomeMap) {
    const expense = expenseMap.get(name);
    if (expense) {
      matchedNames.add(name);
      combinedLines.push({
        categoryName: name,
        incomeBudgeted: income.budgeted,
        incomeActual: income.actual,
        expenseBudgeted: expense.budgeted,
        expenseActual: expense.actual,
        netBudgeted: income.budgeted - expense.budgeted,
        netActual: income.actual - expense.actual,
      });
    }
  }

  // Unmatched lines preserve the original array entries (not grouped)
  const unmatchedIncomeLines = incomeLines.filter(
    (l) => !matchedNames.has(l.categoryName)
  );
  const unmatchedExpenseLines = expenseLines.filter(
    (l) => !matchedNames.has(l.categoryName)
  );

  return { combinedLines, unmatchedIncomeLines, unmatchedExpenseLines };
}
