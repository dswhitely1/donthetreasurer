import { describe, it, expect } from "vitest";

import {
  getNextDay,
  resolveCategoryLabel,
  findCategoryId,
  buildCategorySummaries,
  computeSummary,
} from "./report-utils";

import type { ReportTransaction } from "./types";

describe("getNextDay", () => {
  it("returns next day for a normal date", () => {
    expect(getNextDay("2025-01-15")).toBe("2025-01-16");
  });

  it("handles month boundary", () => {
    expect(getNextDay("2025-01-31")).toBe("2025-02-01");
  });

  it("handles year boundary", () => {
    expect(getNextDay("2025-12-31")).toBe("2026-01-01");
  });

  it("handles February in non-leap year", () => {
    expect(getNextDay("2025-02-28")).toBe("2025-03-01");
  });

  it("handles leap year Feb 28", () => {
    expect(getNextDay("2024-02-28")).toBe("2024-02-29");
  });

  it("handles leap year Feb 29", () => {
    expect(getNextDay("2024-02-29")).toBe("2024-03-01");
  });

  it("handles short months", () => {
    expect(getNextDay("2025-04-30")).toBe("2025-05-01");
    expect(getNextDay("2025-06-30")).toBe("2025-07-01");
  });
});

describe("resolveCategoryLabel", () => {
  const nameMap = { c1: "Donations", c2: "Individual", c3: "Operations" };
  const parentMap: Record<string, string | null> = {
    c1: null,
    c2: "c1",
    c3: null,
  };

  it("returns parent → child format for subcategory", () => {
    expect(resolveCategoryLabel("c2", nameMap, parentMap)).toBe(
      "Donations → Individual"
    );
  });

  it("returns just name for root category", () => {
    expect(resolveCategoryLabel("c1", nameMap, parentMap)).toBe("Donations");
  });

  it("returns Unknown for missing category", () => {
    expect(resolveCategoryLabel("unknown", nameMap, parentMap)).toBe("Unknown");
  });

  it("returns just name if parent not in map", () => {
    const partialParentMap: Record<string, string | null> = {
      c1: null,
      c2: "missing",
    };
    expect(resolveCategoryLabel("c2", nameMap, partialParentMap)).toBe(
      "Individual"
    );
  });
});

describe("findCategoryId", () => {
  const nameMap = { c1: "Donations", c2: "Individual", c3: "Operations" };
  const parentMap: Record<string, string | null> = {
    c1: null,
    c2: "c1",
    c3: null,
  };

  it("finds subcategory by full label", () => {
    expect(findCategoryId("Donations → Individual", nameMap, parentMap)).toBe(
      "c2"
    );
  });

  it("finds root category by name", () => {
    expect(findCategoryId("Operations", nameMap, parentMap)).toBe("c3");
  });

  it('returns "unknown" for non-existent label', () => {
    expect(findCategoryId("Nonexistent", nameMap, parentMap)).toBe("unknown");
  });
});

describe("buildCategorySummaries", () => {
  const nameMap = {
    c1: "Donations",
    c2: "Individual",
    c3: "Corporate",
    c4: "Grants",
  };
  const parentMap: Record<string, string | null> = {
    c1: null,
    c2: "c1",
    c3: "c1",
    c4: null,
  };

  it("groups children under parent", () => {
    const result = buildCategorySummaries(
      { c2: 100, c3: 200 },
      nameMap,
      parentMap
    );
    expect(result).toHaveLength(1);
    expect(result[0].parentName).toBe("Donations");
    expect(result[0].children).toHaveLength(2);
    expect(result[0].subtotal).toBe(300);
  });

  it("sorts parents alphabetically", () => {
    const result = buildCategorySummaries(
      { c2: 100, c4: 50 },
      nameMap,
      parentMap
    );
    expect(result.map((r) => r.parentName)).toEqual(["Donations", "Grants"]);
  });

  it("sorts children alphabetically", () => {
    const result = buildCategorySummaries(
      { c3: 200, c2: 100 },
      nameMap,
      parentMap
    );
    expect(result[0].children.map((c) => c.name)).toEqual([
      "Corporate",
      "Individual",
    ]);
  });

  it("handles root category (no parent)", () => {
    const result = buildCategorySummaries(
      { c4: 500 },
      nameMap,
      parentMap
    );
    expect(result).toHaveLength(1);
    expect(result[0].parentName).toBe("Grants");
    expect(result[0].children[0].name).toBe("(root)");
  });

  it("returns empty array for no amounts", () => {
    expect(buildCategorySummaries({}, nameMap, parentMap)).toEqual([]);
  });
});

describe("computeSummary", () => {
  const nameMap = { c1: "Donations", c2: "Individual", c3: "Supplies" };
  const parentMap: Record<string, string | null> = {
    c1: null,
    c2: "c1",
    c3: null,
  };

  function makeTxn(
    overrides: Partial<ReportTransaction>
  ): ReportTransaction {
    return {
      id: "t1",
      transactionDate: "2025-01-15",
      createdAt: null,
      accountName: "Checking",
      checkNumber: null,
      description: "Test",
      transactionType: "expense",
      amount: 100,
      status: "cleared",
      clearedAt: null,
      lineItems: [{ categoryLabel: "Supplies", amount: 100, memo: null }],
      runningBalance: null,
      ...overrides,
    };
  }

  it("computes totals correctly", () => {
    const transactions: ReportTransaction[] = [
      makeTxn({
        id: "t1",
        transactionType: "income",
        amount: 500,
        lineItems: [
          { categoryLabel: "Donations → Individual", amount: 500, memo: null },
        ],
      }),
      makeTxn({
        id: "t2",
        transactionType: "expense",
        amount: 200,
        lineItems: [{ categoryLabel: "Supplies", amount: 200, memo: null }],
      }),
    ];

    const result = computeSummary(transactions, nameMap, parentMap);
    expect(result.totalIncome).toBe(500);
    expect(result.totalExpenses).toBe(200);
    expect(result.netChange).toBe(300);
  });

  it("computes balance by status with signed amounts", () => {
    const transactions: ReportTransaction[] = [
      makeTxn({
        id: "t1",
        transactionType: "income",
        amount: 1000,
        status: "reconciled",
        lineItems: [
          { categoryLabel: "Donations → Individual", amount: 1000, memo: null },
        ],
      }),
      makeTxn({
        id: "t2",
        transactionType: "expense",
        amount: 300,
        status: "cleared",
      }),
    ];

    const result = computeSummary(transactions, nameMap, parentMap);
    expect(result.balanceByStatus.reconciled).toBe(1000);
    expect(result.balanceByStatus.cleared).toBe(-300);
    expect(result.balanceByStatus.uncleared).toBe(0);
  });

  it("groups income and expense by category", () => {
    const transactions: ReportTransaction[] = [
      makeTxn({
        id: "t1",
        transactionType: "income",
        amount: 500,
        lineItems: [
          { categoryLabel: "Donations → Individual", amount: 500, memo: null },
        ],
      }),
    ];

    const result = computeSummary(transactions, nameMap, parentMap);
    expect(result.incomeByCategory).toHaveLength(1);
    expect(result.incomeByCategory[0].parentName).toBe("Donations");
  });

  it("returns empty summaries for no transactions", () => {
    const result = computeSummary([], nameMap, parentMap);
    expect(result.totalIncome).toBe(0);
    expect(result.totalExpenses).toBe(0);
    expect(result.netChange).toBe(0);
    expect(result.incomeByCategory).toEqual([]);
    expect(result.expensesByCategory).toEqual([]);
  });
});
