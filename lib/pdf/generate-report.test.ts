import { describe, it, expect } from "vitest";

import { generateReportPdf } from "./generate-report";

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
    accountBalances: null,
    ...overrides,
  };
}

describe("generateReportPdf", () => {
  it("returns a valid non-empty Buffer", () => {
    const buffer = generateReportPdf(makeReportData());
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it("starts with PDF magic bytes", () => {
    const buffer = generateReportPdf(makeReportData());
    const header = buffer.subarray(0, 5).toString("ascii");
    expect(header).toBe("%PDF-");
  });

  it("contains the organization name", () => {
    const buffer = generateReportPdf(
      makeReportData({ organizationName: "Corydon Foundation" })
    );
    const text = buffer.toString("latin1");
    expect(text).toContain("Corydon Foundation");
  });

  it("handles empty transactions", () => {
    const buffer = generateReportPdf(makeReportData({ transactions: [] }));
    expect(buffer.length).toBeGreaterThan(0);
    const text = buffer.toString("latin1");
    expect(text).toContain("No transactions found");
  });

  it("handles split transactions with multiple line items", () => {
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
          clearedAt: "2025-03-16T00:00:00Z",
          lineItems: [
            { categoryLabel: "Operations - Supplies", amount: 350, memo: "Paper" },
            { categoryLabel: "Operations - Equipment", amount: 150, memo: "USB" },
          ],
          runningBalance: 500,
        },
      ],
    });

    const buffer = generateReportPdf(data);
    expect(buffer.length).toBeGreaterThan(0);
    const text = buffer.toString("latin1");
    expect(text).toContain("Staples");
    // Category text may be line-wrapped within the PDF column,
    // so check for individual keywords instead of full strings
    expect(text).toContain("Supplies");
    expect(text).toContain("Equipment");
  });

  it("includes summary section content", () => {
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

    const buffer = generateReportPdf(data);
    const text = buffer.toString("latin1");
    expect(text).toContain("OVERALL SUMMARY");
    expect(text).toContain("BALANCE BY STATUS");
    expect(text).toContain("INCOME BY CATEGORY");
    expect(text).toContain("EXPENSES BY CATEGORY");
    expect(text).toContain("Donations");
    expect(text).toContain("Operations");
  });

  it("includes account balances when provided", () => {
    const data = makeReportData({
      accountBalances: [
        {
          accountName: "Checking",
          startingBalance: 1000,
          endingBalance: 3000,
        },
      ],
      transactions: [
        {
          id: "t1",
          transactionDate: "2025-03-15",
          createdAt: null,
          accountName: "Checking",
          checkNumber: null,
          vendor: "Donor",
          description: "Donation",
          transactionType: "income",
          amount: 2000,
          status: "cleared",
          clearedAt: null,
          lineItems: [
            { categoryLabel: "Donations > Individual", amount: 2000, memo: null },
          ],
          runningBalance: 3000,
        },
      ],
    });

    const buffer = generateReportPdf(data);
    const text = buffer.toString("latin1");
    expect(text).toContain("ACCOUNT BALANCES");
    expect(text).toContain("Starting Balance");
    expect(text).toContain("Ending Balance");
  });

  it("includes fiscal year label when provided", () => {
    const data = makeReportData({
      fiscalYearLabel: "FY 2025 (Jan-Dec)",
    });

    const buffer = generateReportPdf(data);
    const text = buffer.toString("latin1");
    expect(text).toContain("FY 2025");
  });
});
