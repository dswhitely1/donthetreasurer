import { describe, expect, it } from "vitest";

import { buildCombinedBudgetLines } from "./budget-combined";

import type { BudgetReportLine } from "./fetch-budget-data";

function makeLine(
  overrides: Partial<BudgetReportLine> & { categoryName: string; categoryType: "income" | "expense" }
): BudgetReportLine {
  return {
    budgeted: 0,
    actual: 0,
    variance: 0,
    variancePercent: null,
    ...overrides,
  };
}

describe("buildCombinedBudgetLines", () => {
  it("returns empty results for empty inputs", () => {
    const result = buildCombinedBudgetLines([], []);
    expect(result.combinedLines).toEqual([]);
    expect(result.unmatchedIncomeLines).toEqual([]);
    expect(result.unmatchedExpenseLines).toEqual([]);
  });

  it("returns all lines as unmatched when no names overlap", () => {
    const income = [
      makeLine({ categoryName: "Donations", categoryType: "income", budgeted: 1000, actual: 800 }),
    ];
    const expense = [
      makeLine({ categoryName: "Rent", categoryType: "expense", budgeted: 500, actual: 450 }),
    ];

    const result = buildCombinedBudgetLines(income, expense);
    expect(result.combinedLines).toEqual([]);
    expect(result.unmatchedIncomeLines).toEqual(income);
    expect(result.unmatchedExpenseLines).toEqual(expense);
  });

  it("combines matching category names into combined lines", () => {
    const income = [
      makeLine({ categoryName: "Fundraising", categoryType: "income", budgeted: 5000, actual: 4500 }),
    ];
    const expense = [
      makeLine({ categoryName: "Fundraising", categoryType: "expense", budgeted: 2000, actual: 1800 }),
    ];

    const result = buildCombinedBudgetLines(income, expense);
    expect(result.combinedLines).toHaveLength(1);
    expect(result.combinedLines[0]).toEqual({
      categoryName: "Fundraising",
      incomeBudgeted: 5000,
      incomeActual: 4500,
      expenseBudgeted: 2000,
      expenseActual: 1800,
      netBudgeted: 3000,
      netActual: 2700,
    });
    expect(result.unmatchedIncomeLines).toEqual([]);
    expect(result.unmatchedExpenseLines).toEqual([]);
  });

  it("handles partial matches correctly", () => {
    const income = [
      makeLine({ categoryName: "Fundraising", categoryType: "income", budgeted: 5000, actual: 4500 }),
      makeLine({ categoryName: "Grants", categoryType: "income", budgeted: 3000, actual: 2500 }),
    ];
    const expense = [
      makeLine({ categoryName: "Fundraising", categoryType: "expense", budgeted: 2000, actual: 1800 }),
      makeLine({ categoryName: "Rent", categoryType: "expense", budgeted: 1000, actual: 1000 }),
    ];

    const result = buildCombinedBudgetLines(income, expense);
    expect(result.combinedLines).toHaveLength(1);
    expect(result.combinedLines[0].categoryName).toBe("Fundraising");
    expect(result.unmatchedIncomeLines).toHaveLength(1);
    expect(result.unmatchedIncomeLines[0].categoryName).toBe("Grants");
    expect(result.unmatchedExpenseLines).toHaveLength(1);
    expect(result.unmatchedExpenseLines[0].categoryName).toBe("Rent");
  });

  it("sums duplicate names within the same type before matching", () => {
    const income = [
      makeLine({ categoryName: "Events", categoryType: "income", budgeted: 1000, actual: 900 }),
      makeLine({ categoryName: "Events", categoryType: "income", budgeted: 2000, actual: 1500 }),
    ];
    const expense = [
      makeLine({ categoryName: "Events", categoryType: "expense", budgeted: 500, actual: 400 }),
    ];

    const result = buildCombinedBudgetLines(income, expense);
    expect(result.combinedLines).toHaveLength(1);
    expect(result.combinedLines[0]).toEqual({
      categoryName: "Events",
      incomeBudgeted: 3000,
      incomeActual: 2400,
      expenseBudgeted: 500,
      expenseActual: 400,
      netBudgeted: 2500,
      netActual: 2000,
    });
    // Duplicate income lines are all consumed (matched name)
    expect(result.unmatchedIncomeLines).toEqual([]);
    expect(result.unmatchedExpenseLines).toEqual([]);
  });

  it("computes correct net values including negative nets", () => {
    const income = [
      makeLine({ categoryName: "Programs", categoryType: "income", budgeted: 1000, actual: 500 }),
    ];
    const expense = [
      makeLine({ categoryName: "Programs", categoryType: "expense", budgeted: 2000, actual: 3000 }),
    ];

    const result = buildCombinedBudgetLines(income, expense);
    expect(result.combinedLines[0].netBudgeted).toBe(-1000);
    expect(result.combinedLines[0].netActual).toBe(-2500);
  });

  it("handles only income lines with no expenses", () => {
    const income = [
      makeLine({ categoryName: "Donations", categoryType: "income", budgeted: 1000, actual: 800 }),
    ];

    const result = buildCombinedBudgetLines(income, []);
    expect(result.combinedLines).toEqual([]);
    expect(result.unmatchedIncomeLines).toEqual(income);
    expect(result.unmatchedExpenseLines).toEqual([]);
  });

  it("handles only expense lines with no income", () => {
    const expense = [
      makeLine({ categoryName: "Rent", categoryType: "expense", budgeted: 500, actual: 500 }),
    ];

    const result = buildCombinedBudgetLines([], expense);
    expect(result.combinedLines).toEqual([]);
    expect(result.unmatchedIncomeLines).toEqual([]);
    expect(result.unmatchedExpenseLines).toEqual(expense);
  });

  it("combines budgeted income with unbudgeted (zero-budget) expense of same name", () => {
    const income = [
      makeLine({ categoryName: "Fundraising → Events", categoryType: "income", budgeted: 5000, actual: 4500 }),
    ];
    const expense = [
      makeLine({ categoryName: "Fundraising → Events", categoryType: "expense", budgeted: 0, actual: 1200 }),
    ];

    const result = buildCombinedBudgetLines(income, expense);
    expect(result.combinedLines).toHaveLength(1);
    expect(result.combinedLines[0]).toEqual({
      categoryName: "Fundraising → Events",
      incomeBudgeted: 5000,
      incomeActual: 4500,
      expenseBudgeted: 0,
      expenseActual: 1200,
      netBudgeted: 5000,
      netActual: 3300,
    });
    expect(result.unmatchedIncomeLines).toEqual([]);
    expect(result.unmatchedExpenseLines).toEqual([]);
  });

  it("combines budgeted expense with unbudgeted (zero-budget) income of same name", () => {
    const income = [
      makeLine({ categoryName: "Programs", categoryType: "income", budgeted: 0, actual: 800 }),
    ];
    const expense = [
      makeLine({ categoryName: "Programs", categoryType: "expense", budgeted: 3000, actual: 2500 }),
    ];

    const result = buildCombinedBudgetLines(income, expense);
    expect(result.combinedLines).toHaveLength(1);
    expect(result.combinedLines[0]).toEqual({
      categoryName: "Programs",
      incomeBudgeted: 0,
      incomeActual: 800,
      expenseBudgeted: 3000,
      expenseActual: 2500,
      netBudgeted: -3000,
      netActual: -1700,
    });
  });

  it("matches names with parent arrow notation", () => {
    const income = [
      makeLine({ categoryName: "Programs > Youth", categoryType: "income", budgeted: 2000, actual: 1800 }),
    ];
    const expense = [
      makeLine({ categoryName: "Programs > Youth", categoryType: "expense", budgeted: 1500, actual: 1200 }),
    ];

    const result = buildCombinedBudgetLines(income, expense);
    expect(result.combinedLines).toHaveLength(1);
    expect(result.combinedLines[0].categoryName).toBe("Programs > Youth");
    expect(result.combinedLines[0].netBudgeted).toBe(500);
    expect(result.combinedLines[0].netActual).toBe(600);
  });
});
