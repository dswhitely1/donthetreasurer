import { describe, it, expect } from "vitest";

import {
  organizationKeys,
  accountKeys,
  categoryKeys,
  transactionKeys,
  reportKeys,
} from "./query-keys";

describe("organizationKeys", () => {
  it("all returns base key", () => {
    expect(organizationKeys.all).toEqual(["organizations"]);
  });

  it("list returns extended key", () => {
    expect(organizationKeys.list()).toEqual(["organizations", "list"]);
  });

  it("detail includes orgId", () => {
    expect(organizationKeys.detail("org-1")).toEqual([
      "organizations",
      "detail",
      "org-1",
    ]);
  });
});

describe("accountKeys", () => {
  it("all returns base key", () => {
    expect(accountKeys.all).toEqual(["accounts"]);
  });

  it("list includes orgId", () => {
    expect(accountKeys.list("org-1")).toEqual(["accounts", "list", "org-1"]);
  });

  it("balances includes orgId", () => {
    expect(accountKeys.balances("org-1")).toEqual([
      "accounts",
      "balances",
      "org-1",
    ]);
  });
});

describe("categoryKeys", () => {
  it("all returns base key", () => {
    expect(categoryKeys.all).toEqual(["categories"]);
  });

  it("list includes orgId", () => {
    expect(categoryKeys.list("org-1")).toEqual(["categories", "list", "org-1"]);
  });
});

describe("transactionKeys", () => {
  it("all returns base key", () => {
    expect(transactionKeys.all).toEqual(["transactions"]);
  });

  it("list includes orgId and default empty filters", () => {
    const key = transactionKeys.list("org-1");
    expect(key).toEqual(["transactions", "list", "org-1", {}]);
  });

  it("list includes orgId and custom filters", () => {
    const filters = { accountId: "acc-1", status: "cleared", page: 2 };
    const key = transactionKeys.list("org-1", filters);
    expect(key).toEqual(["transactions", "list", "org-1", filters]);
  });

  it("detail includes orgId and txnId", () => {
    expect(transactionKeys.detail("org-1", "txn-1")).toEqual([
      "transactions",
      "detail",
      "org-1",
      "txn-1",
    ]);
  });
});

describe("reportKeys", () => {
  it("all returns base key", () => {
    expect(reportKeys.all).toEqual(["reports"]);
  });

  it("data includes orgId and default empty params", () => {
    const key = reportKeys.data("org-1");
    expect(key).toEqual(["reports", "data", "org-1", {}]);
  });

  it("data includes orgId and custom params", () => {
    const params = { startDate: "2025-01-01", endDate: "2025-12-31" };
    const key = reportKeys.data("org-1", params);
    expect(key).toEqual(["reports", "data", "org-1", params]);
  });
});
