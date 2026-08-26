import { describe, it, expect, beforeEach, vi } from "vitest";

import { generateReportPdf } from "./generate-report";

import type { ReportData } from "@/lib/reports/types";
import type { CellInput, UserOptions } from "jspdf-autotable";

/**
 * Every autoTable call in this codebase passes plain array rows
 * (never the object-keyed RowInput variant), so narrow head/body
 * to that shape for straightforward index access in assertions.
 */
type RecordedTable = Omit<UserOptions, "head" | "body"> & {
  head?: CellInput[][];
  body?: CellInput[][];
};

const { recordedTables } = vi.hoisted(() => ({
  recordedTables: [] as RecordedTable[],
}));

vi.mock("jspdf-autotable", async (importOriginal) => {
  const actual = await importOriginal<typeof import("jspdf-autotable")>();
  return {
    ...actual,
    default: (doc: Parameters<typeof actual.default>[0], options: UserOptions) => {
      recordedTables.push(options as RecordedTable);
      return actual.default(doc, options);
    },
  };
});

/** Reads back every jspdf-autotable invocation made during the last render. */
function capturedTables(): RecordedTable[] {
  return recordedTables;
}

beforeEach(() => {
  recordedTables.length = 0;
});

/** Plain text of a single autotable cell, whether it's a raw string or a styled CellDef. */
function cellText(cell: CellInput | undefined): string {
  if (cell == null) return "";
  if (typeof cell === "object" && !Array.isArray(cell) && "content" in cell) {
    return String(cell.content ?? "");
  }
  return String(cell);
}

/** Plain text of every cell in a row. */
function rowText(row: CellInput[]): string[] {
  return row.map(cellText);
}

/** Finds the row whose first cell's text matches exactly. */
function findRowByFirstCellText(table: RecordedTable, text: string): CellInput[] {
  const row = table.body?.find((r) => cellText(r[0]) === text);
  if (!row) {
    throw new Error(`No row found with first cell text: ${text}`);
  }
  return row;
}

/** True when every cell in the row is a bold CellDef. */
function isBoldRow(row: CellInput[]): boolean {
  return row.every(
    (cell) =>
      typeof cell === "object" &&
      !Array.isArray(cell) &&
      cell !== null &&
      cell.styles?.fontStyle === "bold"
  );
}

/** True when any cell in the row carries a textColor style. */
function hasColorStyle(row: CellInput[]): boolean {
  return row.some(
    (cell) =>
      typeof cell === "object" &&
      !Array.isArray(cell) &&
      cell !== null &&
      cell.styles?.textColor !== undefined
  );
}

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

    const buffer = generateReportPdf(data);
    const text = buffer.toString("latin1");
    expect(text).toContain("OVERALL SUMMARY");
    expect(text).toContain("BALANCE BY STATUS");
    expect(text).toContain("Donations");
    expect(text).toContain("Operations");

    // The old three-section layout is gone — a single Category table replaces it.
    expect(text).not.toContain("INCOME BY CATEGORY");
    expect(text).not.toContain("EXPENSES BY CATEGORY");
    expect(text).not.toContain("NET BY CATEGORY");

    const categoryTable = capturedTables().find(
      (t) => t.head?.[0]?.[0] === "Category"
    );
    expect(categoryTable).toBeDefined();
    expect(categoryTable!.head![0]).toEqual(["Category", "In", "Out", "Net"]);

    // Parent rows with subcategories are bold (matching Excel's
    // groupRow.font = { bold: true } for children.length > 0), but not
    // coloured — Task 3 dropped colour and the two exports should match.
    const donationsRow = findRowByFirstCellText(categoryTable!, "Donations");
    expect(rowText(donationsRow)).toEqual([
      "Donations",
      "$5,000.00",
      "$0.00",
      "$5,000.00",
    ]);
    expect(isBoldRow(donationsRow)).toBe(true);
    expect(hasColorStyle(donationsRow)).toBe(false);

    const individualRow = findRowByFirstCellText(categoryTable!, "    Individual");
    expect(rowText(individualRow)).toEqual([
      "    Individual",
      "$5,000.00",
      "$0.00",
      "$5,000.00",
    ]);
    expect(isBoldRow(individualRow)).toBe(false);

    const operationsRow = findRowByFirstCellText(categoryTable!, "Operations");
    expect(rowText(operationsRow)).toEqual([
      "Operations",
      "$0.00",
      "$2,000.00",
      "-$2,000.00",
    ]);
    expect(isBoldRow(operationsRow)).toBe(true);
    expect(hasColorStyle(operationsRow)).toBe(false);

    // Grand total comes from summary.totalIncome/totalExpenses/netChange,
    // not a re-sum of the category rows, and is bold like Excel's totalRow.
    const totalRow = findRowByFirstCellText(categoryTable!, "Total");
    expect(rowText(totalRow)).toEqual([
      "Total",
      "$5,000.00",
      "$2,000.00",
      "$3,000.00",
    ]);
    expect(isBoldRow(totalRow)).toBe(true);
    expect(hasColorStyle(totalRow)).toBe(false);
  });

  it("builds one category table with In/Out/Net columns", () => {
    generateReportPdf(
      makeReportData({
        summary: {
          totalIncome: 8200,
          totalExpenses: 5100,
          netChange: 3100,
          balanceByStatus: { uncleared: 0, cleared: 3100, reconciled: 0 },
          categoryTotals: [
            {
              parentName: "Poinsettias",
              children: [],
              totalIn: 8200,
              totalOut: 5100,
              net: 3100,
            },
          ],
        },
      })
    );

    const categoryTable = capturedTables().find(
      (t) => t.head?.[0]?.[0] === "Category"
    );

    expect(categoryTable).toBeDefined();
    expect(categoryTable!.head![0]).toEqual(["Category", "In", "Out", "Net"]);
    expect(categoryTable!.body).toContainEqual([
      "Poinsettias",
      "$8,200.00",
      "$5,100.00",
      "$3,100.00",
    ]);
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
