import { describe, it, expect } from "vitest";
import ExcelJS from "exceljs";

import { generateReportWorkbook } from "./generate-report";

import type { ReportData } from "@/lib/reports/types";

function makeReportData(overrides: Partial<ReportData> = {}): ReportData {
  return {
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
      incomeByCategory: [],
      expensesByCategory: [],
    },
    ...overrides,
  };
}

async function parseWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  return workbook;
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
    expect(headerRow.getCell(5).value).toBe("Vendor");
    expect(headerRow.getCell(6).value).toBe("Description");
    expect(headerRow.getCell(9).value).toBe("Income");
    expect(headerRow.getCell(10).value).toBe("Expense");
    expect(headerRow.getCell(13).value).toBe("Running Balance");
  });

  it("puts income in column I and expense in column J", async () => {
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

    // Row 7 = first data row (income)
    const incomeRow = sheet.getRow(7);
    expect(incomeRow.getCell(5).value).toBe("Donor Corp"); // Vendor column
    expect(incomeRow.getCell(9).value).toBe(500); // Income column
    expect(incomeRow.getCell(10).value).toBeNull(); // Expense should be null

    // Row 8 = second data row (expense)
    const expenseRow = sheet.getRow(8);
    expect(expenseRow.getCell(5).value).toBe("Staples"); // Vendor column
    expect(expenseRow.getCell(9).value).toBeNull(); // Income should be null
    expect(expenseRow.getCell(10).value).toBe(200); // Expense column
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

    // First line item row (row 7)
    const row7 = sheet.getRow(7);
    expect(row7.getCell(6).value).toBe("Office Supplies"); // Description
    expect(row7.getCell(7).value).toBe("Operations → Supplies"); // Category
    expect(row7.getCell(10).value).toBe(350); // Expense amount

    // Second line item row (row 8) - continuation row
    const row8 = sheet.getRow(8);
    expect(row8.getCell(6).value).toBe(""); // Description blank on continuation
    expect(row8.getCell(7).value).toBe("Operations → Equipment"); // Category
    expect(row8.getCell(10).value).toBe(150); // Expense amount
  });

  it("shows running balance only on last line item of split transaction", async () => {
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

    // First line item: running balance should be null
    expect(sheet.getRow(7).getCell(13).value).toBeNull();
    // Second (last) line item: running balance should be 700
    expect(sheet.getRow(8).getCell(13).value).toBe(700);
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
        incomeByCategory: [
          {
            parentName: "Donations",
            children: [{ name: "Individual", total: 5000 }],
            subtotal: 5000,
          },
        ],
        expensesByCategory: [
          {
            parentName: "Operations",
            children: [{ name: "Supplies", total: 2000 }],
            subtotal: 2000,
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
  });

  it("returns a valid Buffer", async () => {
    const buffer = await generateReportWorkbook(makeReportData());
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
