import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";

import { generateReportWorkbook } from "./generate-report";

import type { ReportData } from "@/lib/reports/types";
import type { BudgetReportData } from "@/lib/reports/fetch-budget-data";

function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  const base: ReportData = {
    organizationName: "Test Foundation",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    generatedAt: "2025-06-15T10:00:00Z",
    transactions: [],
    summary: {
      totalIncome: 0,
      totalExpenses: 0,
      netChange: 0,
      balanceByStatus: { uncleared: 0, cleared: 0, reconciled: 0 },
      categoryTotals: [],
    },
    accountBalances: null,
    dateBasis: "transaction_date",
  };
  return { ...base, ...overrides };
}

async function parseWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
}

async function summarySheetOf(data: ReportData): Promise<ExcelJS.Worksheet> {
  const buffer = await generateReportWorkbook(data);
  const wb = await parseWorkbook(buffer);
  return wb.getWorksheet("Summary")!;
}

function makeBudgetData(overrides: Partial<BudgetReportData> = {}): BudgetReportData {
  const base: BudgetReportData = {
    budgetName: "FY2026 Budget",
    startDate: "2025-01-01",
    endDate: "2025-12-31",
    status: "active",
    netLines: [],
    unbudgetedNet: [],
    netTotals: { budgeted: 0, actual: 0, variance: 0 },
  };
  return { ...base, ...overrides };
}

async function budgetSheetOf(
  budgetData: BudgetReportData,
  reportData: ReportData = makeReportData()
): Promise<ExcelJS.Worksheet> {
  const buffer = await generateReportWorkbook(reportData, budgetData);
  const wb = await parseWorkbook(buffer);
  return wb.getWorksheet("Budget vs. Actuals")!;
}

function findRowByFirstCell(sheet: ExcelJS.Worksheet, value: unknown): number {
  let found = -1;
  sheet.eachRow((row, rowNumber) => {
    if (found === -1 && row.getCell(1).value === value) {
      found = rowNumber;
    }
  });
  if (found === -1) {
    throw new Error(`No row found with first cell value: ${String(value)}`);
  }
  return found;
}

describe("generateReportWorkbook", () => {
  it("creates a workbook with 2 worksheets", async () => {
    const buffer = await generateReportWorkbook(makeReportData());
    const wb = await parseWorkbook(buffer);
    expect(wb.worksheets).toHaveLength(2);
    expect(wb.worksheets[0].name).toBe("Transactions");
    expect(wb.worksheets[1].name).toBe("Summary");
  });

  it("populates header rows with org name and report info", async () => {
    const data = makeReportData({
      organizationName: "Corydon Foundation",
    });
    const buffer = await generateReportWorkbook(data);
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Transactions")!;

    expect(sheet.getRow(1).getCell(1).value).toBe("Corydon Foundation");
    expect(sheet.getRow(2).getCell(1).value).toBe("Transaction Report");
    // Row 3 has the date range
    const row3Value = String(sheet.getRow(3).getCell(1).value);
    expect(row3Value).toContain("01/01/2025");
    expect(row3Value).toContain("12/31/2025");
  });

  it("has column headers on row 6", async () => {
    const buffer = await generateReportWorkbook(makeReportData());
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Transactions")!;
    const headerRow = sheet.getRow(6);

    expect(headerRow.getCell(1).value).toBe("Transaction Date");
    expect(headerRow.getCell(4).value).toBe("Vendor");
    expect(headerRow.getCell(5).value).toBe("Description");
    expect(headerRow.getCell(8).value).toBe("Income");
    expect(headerRow.getCell(9).value).toBe("Expense");
    expect(headerRow.getCell(12).value).toBe("Running Balance");
  });

  it("puts income in column H and expense in column I", async () => {
    const data = makeReportData({
      transactions: [
        {
          id: "t1",
          transactionDate: "2025-03-15",
          createdAt: "2025-03-15T10:00:00Z",
          accountName: "Checking",
          checkNumber: null,
          vendor: "Donor Corp",
          description: "Donation received",
          transactionType: "income",
          amount: 500,
          status: "cleared",
          clearedAt: "2025-03-16T10:00:00Z",
          lineItems: [
            { categoryLabel: "Donations → Individual", amount: 500, memo: null },
          ],
          runningBalance: 1500,
        },
        {
          id: "t2",
          transactionDate: "2025-03-20",
          createdAt: "2025-03-20T10:00:00Z",
          accountName: "Checking",
          checkNumber: "1042",
          vendor: "Staples",
          description: "Office supplies",
          transactionType: "expense",
          amount: 200,
          status: "cleared",
          clearedAt: "2025-03-21T10:00:00Z",
          lineItems: [
            { categoryLabel: "Operations → Supplies", amount: 200, memo: "Paper" },
          ],
          runningBalance: 1300,
        },
      ],
    });

    const buffer = await generateReportWorkbook(data);
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Transactions")!;

    // Row 7 = Account header ("Account: Checking")
    // Row 8 = Status sub-header ("  Cleared")
    // Row 9 = first data row (income)
    const incomeRow = sheet.getRow(9);
    expect(incomeRow.getCell(4).value).toBe("Donor Corp"); // Vendor column
    expect(incomeRow.getCell(8).value).toBe(500); // Income column
    expect(incomeRow.getCell(9).value).toBeNull(); // Expense should be null

    // Row 10 = second data row (expense)
    const expenseRow = sheet.getRow(10);
    expect(expenseRow.getCell(4).value).toBe("Staples"); // Vendor column
    expect(expenseRow.getCell(8).value).toBeNull(); // Income should be null
    expect(expenseRow.getCell(9).value).toBe(200); // Expense column
  });

  it("handles split transaction with multiple rows", async () => {
    const data = makeReportData({
      transactions: [
        {
          id: "t1",
          transactionDate: "2025-03-15",
          createdAt: null,
          accountName: "Checking",
          checkNumber: "1042",
          vendor: "Staples",
          description: "Office Supplies",
          transactionType: "expense",
          amount: 500,
          status: "cleared",
          clearedAt: null,
          lineItems: [
            { categoryLabel: "Operations → Supplies", amount: 350, memo: "Paper" },
            { categoryLabel: "Operations → Equipment", amount: 150, memo: "USB" },
          ],
          runningBalance: 500,
        },
      ],
    });

    const buffer = await generateReportWorkbook(data);
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Transactions")!;

    // Row 7 = Account header ("Account: Checking")
    // Row 8 = Status sub-header ("  Cleared")
    // Row 9 = first line item
    const row9 = sheet.getRow(9);
    expect(row9.getCell(5).value).toBe("Office Supplies"); // Description
    expect(row9.getCell(6).value).toBe("Operations → Supplies"); // Category
    expect(row9.getCell(9).value).toBe(350); // Expense amount

    // Row 10 = second line item (continuation)
    const row10 = sheet.getRow(10);
    expect(row10.getCell(5).value).toBe(""); // Description blank on continuation
    expect(row10.getCell(6).value).toBe("Operations → Equipment"); // Category
    expect(row10.getCell(9).value).toBe(150); // Expense amount
  });

  it("shows running balance as null in grouped view", async () => {
    const data = makeReportData({
      transactions: [
        {
          id: "t1",
          transactionDate: "2025-03-15",
          createdAt: null,
          accountName: "Checking",
          checkNumber: null,
          vendor: null,
          description: "Split transaction",
          transactionType: "expense",
          amount: 300,
          status: "cleared",
          clearedAt: null,
          lineItems: [
            { categoryLabel: "Cat A", amount: 200, memo: null },
            { categoryLabel: "Cat B", amount: 100, memo: null },
          ],
          runningBalance: 700,
        },
      ],
    });

    const buffer = await generateReportWorkbook(data);
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Transactions")!;

    // Row 7 = Account header, Row 8 = Status header, Row 9-10 = data rows
    // In grouped view, running balance column (12) is always null for data rows
    expect(sheet.getRow(9).getCell(12).value).toBeNull();
    expect(sheet.getRow(10).getCell(12).value).toBeNull();
  });

  it("handles empty transactions with a note", async () => {
    const data = makeReportData({ transactions: [] });
    const buffer = await generateReportWorkbook(data);
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Transactions")!;

    const row7 = sheet.getRow(7);
    expect(String(row7.getCell(1).value)).toContain("No transactions found");
  });

  it("populates summary sheet with totals", async () => {
    const data = makeReportData({
      summary: {
        totalIncome: 5000,
        totalExpenses: 2000,
        netChange: 3000,
        balanceByStatus: {
          uncleared: 500,
          cleared: 1500,
          reconciled: 1000,
        },
        categoryTotals: [
          {
            parentName: "Donations",
            children: [{ name: "Individual", in: 5000, out: 0, net: 5000 }],
            totalIn: 5000,
            totalOut: 0,
            net: 5000,
          },
          {
            parentName: "Operations",
            children: [{ name: "Supplies", in: 0, out: 2000, net: -2000 }],
            totalIn: 0,
            totalOut: 2000,
            net: -2000,
          },
        ],
      },
    });

    const buffer = await generateReportWorkbook(data);
    const wb = await parseWorkbook(buffer);
    const sheet = wb.getWorksheet("Summary")!;

    // Find the "Total Income:" row by scanning
    let totalIncomeRow: ExcelJS.Row | null = null;
    sheet.eachRow((row) => {
      if (String(row.getCell(1).value) === "Total Income:") {
        totalIncomeRow = row;
      }
    });
    expect(totalIncomeRow).not.toBeNull();
    expect((totalIncomeRow as unknown as ExcelJS.Row).getCell(2).value).toBe(5000);

    // Category table now carries a single In/Out/Net row per parent
    const headerRow = findRowByFirstCell(sheet, "Category");
    expect(sheet.getCell(headerRow, 2).value).toBe("In");
    expect(sheet.getCell(headerRow, 3).value).toBe("Out");
    expect(sheet.getCell(headerRow, 4).value).toBe("Net");

    const donationsRow = findRowByFirstCell(sheet, "Donations");
    expect(sheet.getCell(donationsRow, 2).value).toBe(5000);
    expect(sheet.getCell(donationsRow, 3).value).toBe(0);
    expect(sheet.getCell(donationsRow, 4).value).toBe(5000);

    const operationsRow = findRowByFirstCell(sheet, "Operations");
    expect(sheet.getCell(operationsRow, 2).value).toBe(0);
    expect(sheet.getCell(operationsRow, 3).value).toBe(2000);
    expect(sheet.getCell(operationsRow, 4).value).toBe(-2000);
  });

  it("renders a single In/Out/Net category table", async () => {
    const data = makeReportData({
      summary: {
        totalIncome: 8200,
        totalExpenses: 5100,
        netChange: 3100,
        balanceByStatus: { uncleared: 0, cleared: 3100, reconciled: 0 },
        categoryTotals: [
          { parentName: "Poinsettias", children: [], totalIn: 8200, totalOut: 5100, net: 3100 },
        ],
      },
    });

    const sheet = await summarySheetOf(data);
    const headerRow = findRowByFirstCell(sheet, "Category");

    expect(sheet.getCell(headerRow, 2).value).toBe("In");
    expect(sheet.getCell(headerRow, 3).value).toBe("Out");
    expect(sheet.getCell(headerRow, 4).value).toBe("Net");
    expect(sheet.getCell(headerRow + 1, 1).value).toBe("Poinsettias");
    expect(sheet.getCell(headerRow + 1, 2).value).toBe(8200);
    expect(sheet.getCell(headerRow + 1, 3).value).toBe(5100);
    expect(sheet.getCell(headerRow + 1, 4).value).toBe(3100);
  });

  it("no longer emits INCOME or EXPENSES section headers", async () => {
    const data = makeReportData({
      summary: {
        totalIncome: 8200,
        totalExpenses: 5100,
        netChange: 3100,
        balanceByStatus: { uncleared: 0, cleared: 3100, reconciled: 0 },
        categoryTotals: [
          { parentName: "Poinsettias", children: [], totalIn: 8200, totalOut: 5100, net: 3100 },
        ],
      },
    });
    const sheet = await summarySheetOf(data);
    const firstCells: unknown[] = [];
    sheet.eachRow((row) => firstCells.push(row.getCell(1).value));

    expect(firstCells).not.toContain("INCOME");
    expect(firstCells).not.toContain("EXPENSES");
    expect(firstCells).not.toContain("INCOME BY CATEGORY");
    expect(firstCells).not.toContain("EXPENSES BY CATEGORY");
    expect(firstCells).not.toContain("NET BY CATEGORY");
  });

  it("returns a valid Buffer", async () => {
    const buffer = await generateReportWorkbook(makeReportData());
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});

describe("generateReportWorkbook budget sheet", () => {
  it("renders a single net table with one row per net line", async () => {
    const budgetData = makeBudgetData({
      netLines: [
        {
          categoryId: "c",
          categoryName: "Poinsettias",
          budgeted: 3100,
          actual: 3400,
          variance: 300,
          favorable: true,
          percentOfPlan: 109.68,
        },
      ],
      netTotals: { budgeted: 3100, actual: 3400, variance: 300 },
    });

    const sheet = await budgetSheetOf(budgetData);

    const headerRow = findRowByFirstCell(sheet, "Category");
    expect(sheet.getCell(headerRow, 1).value).toBe("Category");
    expect(sheet.getCell(headerRow, 2).value).toBe("Budgeted");
    expect(sheet.getCell(headerRow, 3).value).toBe("Actual");
    expect(sheet.getCell(headerRow, 4).value).toBe("Variance");
    expect(sheet.getCell(headerRow, 5).value).toBe("% of Plan");

    const dataRow = headerRow + 1;
    expect(sheet.getCell(dataRow, 1).value).toBe("Poinsettias");
    expect(sheet.getCell(dataRow, 2).value).toBe(3100);
    expect(sheet.getCell(dataRow, 3).value).toBe(3400);
    expect(sheet.getCell(dataRow, 4).value).toBe(300);
    expect(sheet.getCell(dataRow, 5).value).toBe("109.7%");

    const firstCells: unknown[] = [];
    sheet.eachRow((row) => firstCells.push(row.getCell(1).value));
    expect(firstCells).not.toContain("INCOME");
    expect(firstCells).not.toContain("EXPENSES");
    expect(firstCells).not.toContain("COMBINED INCOME & EXPENSE");
  });

  it("colors the variance cell by favorable, not by the sign of variance", async () => {
    // budgeted and actual are both negative, but actual (-800) beats
    // budgeted (-1000) — favorable keys on the budget-vs-actual comparison,
    // not on the sign of either figure alone.
    const budgetData = makeBudgetData({
      netLines: [
        {
          categoryId: "c",
          categoryName: "Fundraiser",
          budgeted: -1000,
          actual: -800,
          variance: 200,
          favorable: true,
          percentOfPlan: 80,
        },
        {
          categoryId: "d",
          categoryName: "Grants",
          budgeted: 500,
          actual: 400,
          variance: -100,
          favorable: false,
          percentOfPlan: 80,
        },
      ],
      netTotals: { budgeted: -500, actual: -400, variance: 100 },
    });

    const sheet = await budgetSheetOf(budgetData);
    const favorableRow = findRowByFirstCell(sheet, "Fundraiser");
    const unfavorableRow = findRowByFirstCell(sheet, "Grants");

    const favorableFill = sheet.getCell(favorableRow, 4).fill as ExcelJS.FillPattern;
    const unfavorableFill = sheet.getCell(unfavorableRow, 4).fill as ExcelJS.FillPattern;

    expect(favorableFill.fgColor?.argb).toBe("FFD6F5D6");
    expect(unfavorableFill.fgColor?.argb).toBe("FFF8D7D7");
  });

  it("renders a null percentOfPlan as an em dash and a negative one unclamped", async () => {
    const budgetData = makeBudgetData({
      netLines: [
        {
          categoryId: "c",
          categoryName: "No Budget Set",
          budgeted: 0,
          actual: 500,
          variance: 500,
          favorable: true,
          percentOfPlan: null,
        },
        {
          categoryId: "d",
          categoryName: "Lost Money",
          budgeted: 200,
          actual: -13,
          variance: -213,
          favorable: false,
          percentOfPlan: -6.5,
        },
      ],
    });

    const sheet = await budgetSheetOf(budgetData);
    const nullRow = findRowByFirstCell(sheet, "No Budget Set");
    const negativeRow = findRowByFirstCell(sheet, "Lost Money");

    expect(sheet.getCell(nullRow, 5).value).toBe("—");
    expect(sheet.getCell(negativeRow, 5).value).toBe("-6.5%");
  });

  it("renders unbudgeted lines after the Total row, under their own heading", async () => {
    const budgetData = makeBudgetData({
      netLines: [
        {
          categoryId: "c",
          categoryName: "Poinsettias",
          budgeted: 3100,
          actual: 3400,
          variance: 300,
          favorable: true,
          percentOfPlan: 109.68,
        },
      ],
      unbudgetedNet: [
        {
          categoryId: "u",
          categoryName: "Surprise Gift",
          budgeted: 0,
          actual: 250,
          variance: 250,
          favorable: true,
          percentOfPlan: null,
        },
      ],
      netTotals: { budgeted: 3100, actual: 3400, variance: 300 },
    });

    const sheet = await budgetSheetOf(budgetData);
    const totalRow = findRowByFirstCell(sheet, "Total (Budgeted Lines)");
    const unbudgetedHeaderRow = findRowByFirstCell(sheet, "UNBUDGETED");
    const unbudgetedLineRow = findRowByFirstCell(sheet, "Surprise Gift");

    expect(unbudgetedHeaderRow).toBeGreaterThan(totalRow);
    expect(unbudgetedLineRow).toBeGreaterThan(unbudgetedHeaderRow);

    // Total reflects netLines only, unaffected by the unbudgeted line.
    expect(sheet.getCell(totalRow, 2).value).toBe(3100);
    expect(sheet.getCell(totalRow, 3).value).toBe(3400);
    expect(sheet.getCell(totalRow, 4).value).toBe(300);
  });
});

describe("generateReportWorkbook signed colour", () => {
  const GREEN = "FF16A34A";
  const RED = "FFDC2626";

  function colorOf(sheet: ExcelJS.Worksheet, row: number, col: number) {
    return (sheet.getCell(row, col).font?.color as { argb?: string } | undefined)
      ?.argb;
  }

  it("colours the Summary Net column by sign, on parents, children and total", async () => {
    const sheet = await summarySheetOf(
      makeReportData({
        summary: {
          totalIncome: 1000,
          totalExpenses: 1500,
          netChange: -500,
          balanceByStatus: { uncleared: 0, cleared: 0, reconciled: 0 },
          categoryTotals: [
            {
              parentName: "Fundraisers",
              totalIn: 1000,
              totalOut: 200,
              net: 800,
              children: [
                { name: "Popcorn", in: 1000, out: 200, net: 800 },
              ],
            },
            {
              parentName: "Uniforms",
              totalIn: 0,
              totalOut: 1300,
              net: -1300,
              children: [],
            },
          ],
        },
      })
    );

    const positiveRow = findRowByFirstCell(sheet, "Fundraisers");
    const childRow = findRowByFirstCell(sheet, "    Popcorn");
    const negativeRow = findRowByFirstCell(sheet, "Uniforms");
    const totalRow = findRowByFirstCell(sheet, "Total");

    expect(colorOf(sheet, positiveRow, 4)).toBe(GREEN);
    expect(colorOf(sheet, childRow, 4)).toBe(GREEN);
    expect(colorOf(sheet, negativeRow, 4)).toBe(RED);
    // netChange is -500, so the total must read red even though In is positive.
    expect(colorOf(sheet, totalRow, 4)).toBe(RED);
  });

  it("keeps the parent row bold when colouring its Net cell", async () => {
    const sheet = await summarySheetOf(
      makeReportData({
        summary: {
          totalIncome: 500,
          totalExpenses: 0,
          netChange: 500,
          balanceByStatus: { uncleared: 0, cleared: 0, reconciled: 0 },
          categoryTotals: [
            {
              parentName: "Grants",
              totalIn: 500,
              totalOut: 0,
              net: 500,
              children: [{ name: "State", in: 500, out: 0, net: 500 }],
            },
          ],
        },
      })
    );

    const row = findRowByFirstCell(sheet, "Grants");
    expect(sheet.getCell(row, 4).font?.bold).toBe(true);
    expect(colorOf(sheet, row, 4)).toBe(GREEN);
  });

  it("sign-colours Budgeted and Actual but leaves Variance to its fill", async () => {
    const sheet = await budgetSheetOf(
      makeBudgetData({
        netLines: [
          {
            categoryId: "a",
            categoryName: "Concessions",
            budgeted: 2000,
            actual: 2500,
            variance: 500,
            favorable: true,
            percentOfPlan: 125,
          },
          {
            categoryId: "b",
            categoryName: "Uniforms",
            budgeted: -1000,
            actual: -800,
            variance: 200,
            favorable: true,
            percentOfPlan: 80,
          },
        ],
        netTotals: { budgeted: 1000, actual: 1700, variance: 700 },
      })
    );

    const incomeRow = findRowByFirstCell(sheet, "Concessions");
    const expenseRow = findRowByFirstCell(sheet, "Uniforms");

    expect(colorOf(sheet, incomeRow, 2)).toBe(GREEN);
    expect(colorOf(sheet, incomeRow, 3)).toBe(GREEN);
    // Signed budget amounts: an expense line is negative, so it reads red.
    expect(colorOf(sheet, expenseRow, 2)).toBe(RED);
    expect(colorOf(sheet, expenseRow, 3)).toBe(RED);

    // Variance keeps the favorable/unfavorable fill and gets no sign colour --
    // under-spending an expense line is negative but good, so a sign colour
    // here would contradict the fill in the same cell.
    expect(colorOf(sheet, expenseRow, 4)).toBeUndefined();
    expect(
      (sheet.getCell(expenseRow, 4).fill as ExcelJS.FillPattern).fgColor?.argb
    ).toBe("FFD6F5D6");
  });
});
