import { describe, it, expect } from "vitest";

import {
  getAccountBalances,
  getReconciledBalance,
  computeRunningBalances,
} from "./balances";

describe("getAccountBalances", () => {
  it("returns opening balance when no transactions", () => {
    const result = getAccountBalances(
      [{ id: "a1", opening_balance: 1000 }],
      []
    );
    const balance = result.get("a1")!;
    expect(balance.currentBalance).toBe(1000);
    expect(balance.totalIncome).toBe(0);
    expect(balance.totalExpense).toBe(0);
    expect(balance.statusNet).toEqual({
      uncleared: 0,
      cleared: 0,
      reconciled: 0,
    });
  });

  it("handles null opening_balance as 0", () => {
    const result = getAccountBalances(
      [{ id: "a1", opening_balance: null }],
      []
    );
    expect(result.get("a1")!.currentBalance).toBe(0);
  });

  it("adds income to balance", () => {
    const result = getAccountBalances(
      [{ id: "a1", opening_balance: 500 }],
      [
        { account_id: "a1", amount: 200, transaction_type: "income", status: "cleared" },
      ]
    );
    const balance = result.get("a1")!;
    expect(balance.currentBalance).toBe(700);
    expect(balance.totalIncome).toBe(200);
    expect(balance.totalExpense).toBe(0);
  });

  it("subtracts expense from balance", () => {
    const result = getAccountBalances(
      [{ id: "a1", opening_balance: 500 }],
      [
        { account_id: "a1", amount: 150, transaction_type: "expense", status: "cleared" },
      ]
    );
    const balance = result.get("a1")!;
    expect(balance.currentBalance).toBe(350);
    expect(balance.totalExpense).toBe(150);
  });

  it("computes status breakdown with signed net", () => {
    const result = getAccountBalances(
      [{ id: "a1", opening_balance: 0 }],
      [
        { account_id: "a1", amount: 1000, transaction_type: "income", status: "reconciled" },
        { account_id: "a1", amount: 300, transaction_type: "expense", status: "reconciled" },
        { account_id: "a1", amount: 200, transaction_type: "income", status: "cleared" },
        { account_id: "a1", amount: 50, transaction_type: "expense", status: "uncleared" },
      ]
    );
    const balance = result.get("a1")!;
    expect(balance.statusNet.reconciled).toBe(700); // 1000 - 300
    expect(balance.statusNet.cleared).toBe(200);
    expect(balance.statusNet.uncleared).toBe(-50);
    expect(balance.currentBalance).toBe(850); // 1000 - 300 + 200 - 50
  });

  it("handles multiple accounts", () => {
    const result = getAccountBalances(
      [
        { id: "a1", opening_balance: 100 },
        { id: "a2", opening_balance: 500 },
      ],
      [
        { account_id: "a1", amount: 50, transaction_type: "income", status: "cleared" },
        { account_id: "a2", amount: 200, transaction_type: "expense", status: "uncleared" },
      ]
    );
    expect(result.get("a1")!.currentBalance).toBe(150);
    expect(result.get("a2")!.currentBalance).toBe(300);
  });

  it("ignores transactions for unknown accounts", () => {
    const result = getAccountBalances(
      [{ id: "a1", opening_balance: 100 }],
      [
        { account_id: "unknown", amount: 500, transaction_type: "income", status: "cleared" },
      ]
    );
    expect(result.get("a1")!.currentBalance).toBe(100);
    expect(result.has("unknown")).toBe(false);
  });

  it("accumulates multiple transactions for same account", () => {
    const result = getAccountBalances(
      [{ id: "a1", opening_balance: 0 }],
      [
        { account_id: "a1", amount: 100, transaction_type: "income", status: "cleared" },
        { account_id: "a1", amount: 200, transaction_type: "income", status: "cleared" },
        { account_id: "a1", amount: 50, transaction_type: "expense", status: "cleared" },
      ]
    );
    const balance = result.get("a1")!;
    expect(balance.currentBalance).toBe(250);
    expect(balance.totalIncome).toBe(300);
    expect(balance.totalExpense).toBe(50);
  });
});

describe("getReconciledBalance", () => {
  it("returns opening balance when no transactions", () => {
    expect(getReconciledBalance(1000, [])).toBe(1000);
  });

  it("only includes reconciled transactions", () => {
    const result = getReconciledBalance(500, [
      { amount: 200, transaction_type: "income", status: "reconciled" },
      { amount: 100, transaction_type: "income", status: "cleared" },
      { amount: 50, transaction_type: "expense", status: "uncleared" },
      { amount: 75, transaction_type: "expense", status: "reconciled" },
    ]);
    // 500 + 200 - 75 = 625 (cleared and uncleared are ignored)
    expect(result).toBe(625);
  });

  it("adds reconciled income", () => {
    expect(
      getReconciledBalance(0, [
        { amount: 300, transaction_type: "income", status: "reconciled" },
      ])
    ).toBe(300);
  });

  it("subtracts reconciled expenses", () => {
    expect(
      getReconciledBalance(1000, [
        { amount: 250, transaction_type: "expense", status: "reconciled" },
      ])
    ).toBe(750);
  });

  it("handles zero opening balance", () => {
    expect(getReconciledBalance(0, [])).toBe(0);
  });

  it("can produce negative balance", () => {
    expect(
      getReconciledBalance(100, [
        { amount: 300, transaction_type: "expense", status: "reconciled" },
      ])
    ).toBe(-200);
  });
});

describe("computeRunningBalances", () => {
  it("accumulates running balance sequentially", () => {
    const result = computeRunningBalances(1000, [
      { id: "t1", amount: 200, transaction_type: "income" },
      { id: "t2", amount: 50, transaction_type: "expense" },
      { id: "t3", amount: 100, transaction_type: "expense" },
    ]);
    expect(result.get("t1")).toBe(1200);
    expect(result.get("t2")).toBe(1150);
    expect(result.get("t3")).toBe(1050);
  });

  it("income adds to balance", () => {
    const result = computeRunningBalances(0, [
      { id: "t1", amount: 500, transaction_type: "income" },
    ]);
    expect(result.get("t1")).toBe(500);
  });

  it("expense subtracts from balance", () => {
    const result = computeRunningBalances(1000, [
      { id: "t1", amount: 300, transaction_type: "expense" },
    ]);
    expect(result.get("t1")).toBe(700);
  });

  it("returns empty map for no transactions", () => {
    const result = computeRunningBalances(1000, []);
    expect(result.size).toBe(0);
  });

  it("handles zero opening balance", () => {
    const result = computeRunningBalances(0, [
      { id: "t1", amount: 100, transaction_type: "expense" },
    ]);
    expect(result.get("t1")).toBe(-100);
  });

  it("can produce negative running balance", () => {
    const result = computeRunningBalances(100, [
      { id: "t1", amount: 200, transaction_type: "expense" },
    ]);
    expect(result.get("t1")).toBe(-100);
  });
});
