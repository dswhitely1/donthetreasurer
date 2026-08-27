import { describe, expect, it } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";

import {
  buildNetLine,
  collectDescendantIds,
  fetchBudgetReportData,
} from "./fetch-budget-data";

describe("collectDescendantIds", () => {
  it("collects grandchildren, not just direct children", () => {
    const children = new Map([
      ["a", ["b"]],
      ["b", ["c"]],
    ]);
    expect(collectDescendantIds("a", children).sort()).toEqual(["b", "c"]);
  });

  it("terminates on a parent cycle", () => {
    const children = new Map([
      ["a", ["b"]],
      ["b", ["a"]],
    ]);
    expect(collectDescendantIds("a", children)).toEqual(["b"]);
  });

  it("returns an empty array for a leaf", () => {
    expect(collectDescendantIds("a", new Map())).toEqual([]);
  });
});

describe("buildNetLine", () => {
  const noChildren = new Map<string, string[]>();

  it("under-collected income is unfavorable", () => {
    const line = buildNetLine("c", "Dues", 12400, new Map([["c", 8200]]), noChildren);
    expect(line.variance).toBe(-4200);
    expect(line.favorable).toBe(false);
    expect(line.percentOfPlan).toBeCloseTo(66.13, 2);
  });

  it("under-spent expense is favorable", () => {
    const line = buildNetLine("c", "Repairs", -1000, new Map([["c", -430]]), noChildren);
    expect(line.variance).toBe(570);
    expect(line.favorable).toBe(true);
    expect(line.percentOfPlan).toBeCloseTo(43, 2);
  });

  it("beating a net plan is favorable", () => {
    const line = buildNetLine("c", "Poinsettias", 3100, new Map([["c", 3400]]), noChildren);
    expect(line.variance).toBe(300);
    expect(line.favorable).toBe(true);
    expect(line.percentOfPlan).toBeCloseTo(109.68, 2);
  });

  it("reports a negative percent when a planned-positive activity loses money", () => {
    const line = buildNetLine("c", "Poinsettias", 3100, new Map([["c", -200]]), noChildren);
    expect(line.variance).toBe(-3300);
    expect(line.favorable).toBe(false);
    expect(line.percentOfPlan).toBeCloseTo(-6.45, 2);
  });

  it("returns null percent when nothing is budgeted", () => {
    expect(buildNetLine("c", "X", 0, new Map(), noChildren).percentOfPlan).toBeNull();
  });

  it("rolls descendant activity into a parent line", () => {
    const line = buildNetLine(
      "p",
      "Fundraising",
      3000,
      new Map([["p", 100], ["child", 2900]]),
      new Map([["p", ["child"]]])
    );
    expect(line.actual).toBe(3000);
    expect(line.favorable).toBe(true);
  });

  // Regression guard: a plan of -1000.00 met by expense line items totaling
  // exactly 1000.00 in decimal (0.07 + 512.07 + 487.86) accumulates to
  // -1000.0000000000001 via plain floating-point addition. Before rounding
  // was added, this produced favorable: false and a non-zero variance for a
  // line that was exactly on plan.
  it("treats a line exactly on plan as favorable with zero variance despite float residue", () => {
    const rawActual = -(0.07 + 512.07 + 487.86);
    expect(rawActual).not.toBe(-1000); // sanity: the float residue is real
    const line = buildNetLine("c", "Supplies", -1000, new Map([["c", rawActual]]), noChildren);
    expect(line.favorable).toBe(true);
    expect(line.variance).toBe(0);
    expect(line.actual).toBe(-1000);
  });
});

describe("fetchBudgetReportData", () => {
  const orgId = "org-1";
  const budgetId = "budget-1";

  function baseBudget(overrides: {
    budget_line_items?: Array<{ id: string; amount: number; category_id: string }>;
    status?: string;
  } = {}) {
    return {
      id: budgetId,
      organization_id: orgId,
      name: "Test Budget",
      start_date: "2026-01-01",
      end_date: "2026-12-31",
      status: overrides.status ?? "active",
      notes: null,
      budget_line_items: overrides.budget_line_items ?? [],
    };
  }

  function txn(
    type: "income" | "expense",
    lineItems: Array<{ category_id: string; amount: number }>
  ) {
    return {
      id: `txn-${Math.random()}`,
      transaction_type: type,
      accounts: { organization_id: orgId },
      transaction_line_items: lineItems,
    };
  }

  // fetchBudgetReportData issues three sequential `.from()` calls, in this
  // order: budgets (with nested line items), categories, transactions.
  function mockSequence(
    supabase: ReturnType<typeof createMockSupabaseClient>,
    budget: unknown,
    categories: Array<{ id: string; name: string; parent_id: string | null }>,
    transactions: unknown[]
  ) {
    supabase.mockChain().sequence([
      { data: budget, error: null },
      { data: categories, error: null },
      { data: transactions, error: null },
    ]);
  }

  it("nets an income and an expense transaction on the same category correctly", async () => {
    const supabase = createMockSupabaseClient();
    mockSequence(
      supabase,
      baseBudget({
        budget_line_items: [{ id: "li1", amount: 300, category_id: "cat-1" }],
      }),
      [{ id: "cat-1", name: "Fundraising", parent_id: null }],
      [
        txn("income", [{ category_id: "cat-1", amount: 500 }]),
        txn("expense", [{ category_id: "cat-1", amount: 200 }]),
      ]
    );

    const result = await fetchBudgetReportData(supabase as never, budgetId);

    expect(result).not.toBeNull();
    expect(result?.netLines).toHaveLength(1);
    expect(result?.netLines[0].actual).toBe(300);
    expect(result?.netLines[0].favorable).toBe(true);
  });

  // An inverted sign ternary (income = -1, expense = +1) would flip this: an
  // income-only category would come out negative, an expense-only category
  // would come out positive.
  it("signs income positive and expense negative independently", async () => {
    const supabase = createMockSupabaseClient();
    mockSequence(
      supabase,
      baseBudget({
        budget_line_items: [
          { id: "li1", amount: 500, category_id: "cat-income" },
          { id: "li2", amount: -200, category_id: "cat-expense" },
        ],
      }),
      [
        { id: "cat-income", name: "Dues", parent_id: null },
        { id: "cat-expense", name: "Supplies", parent_id: null },
      ],
      [
        txn("income", [{ category_id: "cat-income", amount: 500 }]),
        txn("expense", [{ category_id: "cat-expense", amount: 200 }]),
      ]
    );

    const result = await fetchBudgetReportData(supabase as never, budgetId);

    const income = result?.netLines.find((l) => l.categoryId === "cat-income");
    const expense = result?.netLines.find((l) => l.categoryId === "cat-expense");
    expect(income?.actual).toBe(500);
    expect(expense?.actual).toBe(-200);
  });

  it("excludes a budgeted parent's descendant activity from unbudgetedNet", async () => {
    const supabase = createMockSupabaseClient();
    mockSequence(
      supabase,
      baseBudget({
        budget_line_items: [{ id: "li1", amount: 1000, category_id: "cat-parent" }],
      }),
      [
        { id: "cat-parent", name: "Fundraising", parent_id: null },
        { id: "cat-child", name: "Bake Sale", parent_id: "cat-parent" },
      ],
      [txn("income", [{ category_id: "cat-child", amount: 1200 }])]
    );

    const result = await fetchBudgetReportData(supabase as never, budgetId);

    expect(result?.unbudgetedNet).toHaveLength(0);
    expect(result?.netLines[0].actual).toBe(1200);
  });

  it("sums netTotals from netLines only, not from unbudgetedNet", async () => {
    const supabase = createMockSupabaseClient();
    mockSequence(
      supabase,
      baseBudget({
        budget_line_items: [{ id: "li1", amount: 1000, category_id: "cat-budgeted" }],
      }),
      [
        { id: "cat-budgeted", name: "Fundraising", parent_id: null },
        { id: "cat-unbudgeted", name: "Misc", parent_id: null },
      ],
      [
        txn("income", [{ category_id: "cat-budgeted", amount: 1000 }]),
        txn("income", [{ category_id: "cat-unbudgeted", amount: 9999 }]),
      ]
    );

    const result = await fetchBudgetReportData(supabase as never, budgetId);

    expect(result?.unbudgetedNet).toHaveLength(1);
    expect(result?.unbudgetedNet[0].actual).toBe(9999);
    expect(result?.netTotals.actual).toBe(1000);
    expect(result?.netTotals.budgeted).toBe(1000);
    expect(result?.netTotals.variance).toBe(0);
  });

  // Regression guard for the float-residue bug (see Fix 1): a plan of
  // -1000.00 met by three expense line items that sum to exactly 1000.00 in
  // decimal must come out favorable with zero variance end-to-end.
  it("treats an on-plan expense budget as favorable with zero variance through the full pipeline", async () => {
    const supabase = createMockSupabaseClient();
    mockSequence(
      supabase,
      baseBudget({
        budget_line_items: [{ id: "li1", amount: -1000, category_id: "cat-1" }],
      }),
      [{ id: "cat-1", name: "Supplies", parent_id: null }],
      [
        txn("expense", [{ category_id: "cat-1", amount: 0.07 }]),
        txn("expense", [{ category_id: "cat-1", amount: 512.07 }]),
        txn("expense", [{ category_id: "cat-1", amount: 487.86 }]),
      ]
    );

    const result = await fetchBudgetReportData(supabase as never, budgetId);

    expect(result?.netLines[0].favorable).toBe(true);
    expect(result?.netLines[0].variance).toBe(0);
  });

  // Regression guard for the float-residue bug (see Fix 1): income
  // 100.10 + 200.20 netted against expense 300.30 on an unbudgeted category
  // is exactly zero in decimal, but sums to -5.68e-14 via plain
  // floating-point addition. It must not appear under "Unbudgeted Actuals".
  it("excludes an unbudgeted category that nets to zero despite float residue", async () => {
    const supabase = createMockSupabaseClient();
    mockSequence(
      supabase,
      baseBudget(),
      [{ id: "cat-1", name: "Misc", parent_id: null }],
      [
        txn("income", [{ category_id: "cat-1", amount: 100.1 }]),
        txn("income", [{ category_id: "cat-1", amount: 200.2 }]),
        txn("expense", [{ category_id: "cat-1", amount: 300.3 }]),
      ]
    );

    const result = await fetchBudgetReportData(supabase as never, budgetId);

    expect(result?.unbudgetedNet).toHaveLength(0);
  });
});
