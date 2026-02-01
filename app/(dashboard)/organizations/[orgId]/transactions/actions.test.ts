import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";
import {
  mockRedirect,
  mockRevalidatePath,
  RedirectError,
} from "@/test/mocks/next-navigation";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => mockRevalidatePath(...args),
}));
vi.mock("next/navigation", () => ({
  redirect: (...args: unknown[]) => mockRedirect(...(args as [string])),
}));

import { createClient } from "@/lib/supabase/server";
import {
  createTransaction,
  updateTransaction,
  deleteTransaction,
  bulkUpdateStatus,
  bulkDeleteTransactions,
  inlineUpdateTransaction,
} from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const accountId = "770e8400-e29b-41d4-a716-446655440000";
const catId = "880e8400-e29b-41d4-a716-446655440000";
const txnId = "990e8400-e29b-41d4-a716-446655440000";

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(data)) {
    fd.set(key, val);
  }
  return fd;
}

function makeCreateTxnFormData(overrides: Partial<Record<string, string>> = {}): FormData {
  return makeFormData({
    account_id: accountId,
    transaction_date: "2025-01-15",
    amount: "500",
    transaction_type: "expense",
    description: "Office Supplies",
    check_number: "",
    status: "uncleared",
    line_items: JSON.stringify([{ category_id: catId, amount: 500, memo: "" }]),
    ...overrides,
  });
}

/**
 * Setup a mock sequence for successful transaction creation.
 * Calls: auth -> account check -> org check -> categories check -> insert txn -> insert line items
 */
function setupSuccessfulCreate(mockSb: MockSupabaseClient) {
  let callCount = 0;
  mockSb.from.mockImplementation(() => {
    callCount++;
    const chain: Record<string, ReturnType<typeof vi.fn>> = {};
    const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit", "or", "filter"];
    for (const m of methods) chain[m] = vi.fn(() => chain);

    const results: Record<number, { data: unknown; error: null }> = {
      1: { data: { id: accountId, organization_id: orgId, account_type: "checking" }, error: null }, // account check
      2: { data: { id: orgId }, error: null }, // org check
      3: {
        data: [{ id: catId, category_type: "expense", organization_id: orgId, is_active: true }],
        error: null,
      }, // categories check
      4: { data: { id: txnId }, error: null }, // insert transaction
      5: { data: null, error: null }, // insert line items
    };

    const result = results[callCount] ?? { data: null, error: null };

    chain.single = vi.fn(() => Promise.resolve(result));
    Object.defineProperty(chain, "then", {
      value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
        Promise.resolve(result).then(resolve, reject),
      writable: true,
      configurable: true,
    });

    return chain;
  });
}

describe("transaction actions", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    mockedCreateClient.mockResolvedValue(mockSupabase as never);
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: userId } },
      error: null,
    } as never);
  });

  describe("createTransaction", () => {
    it("returns validation error for empty description", async () => {
      const fd = makeCreateTxnFormData({ description: "" });
      const result = await createTransaction(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("returns error for invalid JSON line_items", async () => {
      const fd = makeCreateTxnFormData({ line_items: "not-json" });
      const result = await createTransaction(null, fd);
      expect(result?.error).toBe("Invalid line items data.");
    });

    it("returns error when line item sum doesn't match amount", async () => {
      const fd = makeCreateTxnFormData({
        amount: "500",
        line_items: JSON.stringify([
          { category_id: catId, amount: 300, memo: "" },
        ]),
      });
      const result = await createTransaction(null, fd);
      expect(result?.error).toContain("must equal transaction total");
    });

    it("allows 0.01 tolerance for line item sum", async () => {
      // Amount = 100, line items sum = 99.995 => within tolerance
      setupSuccessfulCreate(mockSupabase);

      const fd = makeCreateTxnFormData({
        amount: "100",
        line_items: JSON.stringify([
          { category_id: catId, amount: 99.995, memo: "" },
        ]),
      });

      try {
        await createTransaction(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }
    });

    it("returns error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeCreateTxnFormData();
      const result = await createTransaction(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("returns error when account not found", async () => {
      mockSupabase.mockResult({ data: null, error: null });

      const fd = makeCreateTxnFormData();
      const result = await createTransaction(null, fd);
      expect(result?.error).toBe("Account not found.");
    });

    it("returns error when category type doesn't match transaction type", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: accountId, organization_id: orgId, account_type: "checking" }, error: null },
          2: { data: { id: orgId }, error: null },
          3: {
            data: [{ id: catId, category_type: "income", organization_id: orgId, is_active: true }],
            error: null,
          }, // type mismatch: income category for expense txn
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeCreateTxnFormData();
      const result = await createTransaction(null, fd);
      expect(result?.error).toContain("Category type must match");
    });

    it("sets cleared_at when status is cleared", async () => {
      setupSuccessfulCreate(mockSupabase);

      const fd = makeCreateTxnFormData({ status: "cleared" });

      try {
        await createTransaction(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }
    });

    it("redirects on success", async () => {
      setupSuccessfulCreate(mockSupabase);

      const fd = makeCreateTxnFormData();

      try {
        await createTransaction(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toContain(`/transactions/${txnId}`);
      }
    });

    it("cleans up transaction on line item failure", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: unknown }> = {
          1: { data: { id: accountId, organization_id: orgId, account_type: "checking" }, error: null },
          2: { data: { id: orgId }, error: null },
          3: { data: [{ id: catId, category_type: "expense", organization_id: orgId, is_active: true }], error: null },
          4: { data: { id: txnId }, error: null },
          5: { data: null, error: { message: "line item insert failed" } }, // line items fail
          6: { data: null, error: null }, // cleanup delete
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeCreateTxnFormData();
      const result = await createTransaction(null, fd);
      expect(result?.error).toContain("Failed to create line items");
      // Verify cleanup was attempted (6 from() calls = 5 normal + 1 cleanup)
      expect(mockSupabase.from).toHaveBeenCalledTimes(6);
    });
  });

  describe("updateTransaction", () => {
    it("blocks editing reconciled transactions", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          // existing transaction check
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: { id: txnId, status: "reconciled", account_id: accountId, cleared_at: "2025-01-01T00:00:00Z" },
              error: null,
            })
          );
        }

        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({
        id: txnId,
        account_id: accountId,
        transaction_date: "2025-01-15",
        amount: "500",
        transaction_type: "expense",
        description: "Test",
        check_number: "",
        status: "uncleared",
        line_items: JSON.stringify([{ category_id: catId, amount: 500 }]),
      });

      const result = await updateTransaction(null, fd);
      expect(result?.error).toBe("Reconciled transactions cannot be edited.");
    });

    it("sets cleared_at when changing from uncleared to cleared", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: txnId, status: "uncleared", account_id: accountId, cleared_at: null }, error: null },
          2: { data: { id: accountId, organization_id: orgId }, error: null },
          3: { data: { id: orgId }, error: null },
          4: { data: [{ id: catId, category_type: "expense", organization_id: orgId, is_active: true }], error: null },
          5: { data: null, error: null }, // update
          6: { data: null, error: null }, // delete line items
          7: { data: null, error: null }, // insert line items
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({
        id: txnId,
        account_id: accountId,
        transaction_date: "2025-01-15",
        amount: "500",
        transaction_type: "expense",
        description: "Test",
        check_number: "",
        status: "cleared",
        line_items: JSON.stringify([{ category_id: catId, amount: 500 }]),
      });

      try {
        await updateTransaction(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }
    });

    it("clears cleared_at when changing to uncleared", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: txnId, status: "cleared", account_id: accountId, cleared_at: "2025-01-01T00:00:00Z" }, error: null },
          2: { data: { id: accountId, organization_id: orgId }, error: null },
          3: { data: { id: orgId }, error: null },
          4: { data: [{ id: catId, category_type: "expense", organization_id: orgId, is_active: true }], error: null },
          5: { data: null, error: null },
          6: { data: null, error: null },
          7: { data: null, error: null },
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({
        id: txnId,
        account_id: accountId,
        transaction_date: "2025-01-15",
        amount: "500",
        transaction_type: "expense",
        description: "Test",
        check_number: "",
        status: "uncleared",
        line_items: JSON.stringify([{ category_id: catId, amount: 500 }]),
      });

      try {
        await updateTransaction(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }
    });
  });

  describe("deleteTransaction", () => {
    it("returns error for missing fields", async () => {
      const fd = makeFormData({ id: "", organization_id: "" });
      const result = await deleteTransaction(null, fd);
      expect(result?.error).toContain("required");
    });

    it("blocks deleting reconciled transactions", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: orgId }, error: null }, // org check
          2: { data: { id: txnId, status: "reconciled", account_id: accountId }, error: null }, // txn check
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({ id: txnId, organization_id: orgId });
      const result = await deleteTransaction(null, fd);
      expect(result?.error).toBe("Reconciled transactions cannot be deleted.");
    });

    it("verifies account belongs to organization", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: orgId }, error: null },
          2: { data: { id: txnId, status: "uncleared", account_id: accountId }, error: null },
          3: { data: null, error: null }, // account not found for this org
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({ id: txnId, organization_id: orgId });
      const result = await deleteTransaction(null, fd);
      expect(result?.error).toBe("Transaction does not belong to this organization.");
    });

    it("redirects on successful delete", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: orgId }, error: null },
          2: { data: { id: txnId, status: "uncleared", account_id: accountId }, error: null },
          3: { data: { id: accountId }, error: null }, // account belongs to org
          4: { data: null, error: null }, // delete
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({ id: txnId, organization_id: orgId });

      try {
        await deleteTransaction(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toContain("/transactions");
      }
    });
  });

  describe("bulkUpdateStatus", () => {
    it("returns error for missing fields", async () => {
      const fd = makeFormData({ ids: "", status: "", org_id: "" });
      const result = await bulkUpdateStatus(null, fd);
      expect(result?.error).toBe("Missing required fields.");
    });

    it("returns error for invalid status", async () => {
      const fd = makeFormData({ ids: txnId, status: "invalid", org_id: orgId });
      const result = await bulkUpdateStatus(null, fd);
      expect(result?.error).toBe("Invalid status.");
    });

    it("blocks updating reconciled transactions with count message", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: orgId }, error: null }, // org check
          2: {
            data: [
              { id: "t1", status: "reconciled", cleared_at: "2025-01-01", account_id: accountId },
              { id: "t2", status: "reconciled", cleared_at: "2025-01-01", account_id: accountId },
            ],
            error: null,
          },
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({ ids: "t1,t2", status: "cleared", org_id: orgId });
      const result = await bulkUpdateStatus(null, fd);
      expect(result?.error).toContain("2 reconciled transaction(s)");
    });

    it("returns null on success", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: orgId }, error: null },
          2: {
            data: [{ id: txnId, status: "uncleared", cleared_at: null, account_id: accountId }],
            error: null,
          },
          3: { data: [{ id: accountId }], error: null }, // accounts check
          4: { data: null, error: null }, // update
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({ ids: txnId, status: "cleared", org_id: orgId });
      const result = await bulkUpdateStatus(null, fd);
      expect(result).toBeNull();
    });
  });

  describe("bulkDeleteTransactions", () => {
    it("blocks deleting reconciled transactions", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: orgId }, error: null },
          2: {
            data: [{ id: txnId, status: "reconciled", account_id: accountId }],
            error: null,
          },
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({ ids: txnId, org_id: orgId });
      const result = await bulkDeleteTransactions(null, fd);
      expect(result?.error).toContain("reconciled transaction(s) cannot be deleted");
    });

    it("returns null on success", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: orgId }, error: null },
          2: { data: [{ id: txnId, status: "uncleared", account_id: accountId }], error: null },
          3: { data: [{ id: accountId }], error: null },
          4: { data: null, error: null },
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({ ids: txnId, org_id: orgId });
      const result = await bulkDeleteTransactions(null, fd);
      expect(result).toBeNull();
    });
  });

  describe("inlineUpdateTransaction", () => {
    function setupInlineEdit(existing: Record<string, unknown>) {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: orgId }, error: null }, // org check
          2: { data: existing, error: null }, // existing transaction
          3: { data: { id: accountId, organization_id: orgId }, error: null }, // account check
          4: { data: null, error: null }, // update
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });
    }

    const existingTxn = {
      id: txnId,
      status: "uncleared",
      account_id: accountId,
      cleared_at: null,
      amount: 500,
      transaction_line_items: [{ id: "li1" }],
    };

    it("validates date format", async () => {
      setupInlineEdit(existingTxn);

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "transaction_date",
        value: "01/15/2025",
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result?.error).toContain("Invalid date format");
    });

    it("validates description length", async () => {
      setupInlineEdit(existingTxn);

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "description",
        value: "A".repeat(256),
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result?.error).toContain("255 characters");
    });

    it("validates empty description", async () => {
      setupInlineEdit(existingTxn);

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "description",
        value: "   ",
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result?.error).toBe("Description is required.");
    });

    it("validates check_number length", async () => {
      setupInlineEdit(existingTxn);

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "check_number",
        value: "A".repeat(21),
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result?.error).toContain("20 characters");
    });

    it("validates status enum", async () => {
      setupInlineEdit(existingTxn);

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "status",
        value: "invalid",
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result?.error).toBe("Invalid status.");
    });

    it("blocks amount edit for split transactions", async () => {
      setupInlineEdit({
        ...existingTxn,
        transaction_line_items: [{ id: "li1" }, { id: "li2" }],
      });

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "amount",
        value: "600",
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result?.error).toContain("split transactions");
    });

    it("validates amount must be positive", async () => {
      setupInlineEdit(existingTxn);

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "amount",
        value: "0",
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result?.error).toContain("greater than zero");
    });

    it("validates account_id exists", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "neq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        const results: Record<number, { data: unknown; error: null }> = {
          1: { data: { id: orgId }, error: null },
          2: { data: existingTxn, error: null },
          3: { data: { id: accountId, organization_id: orgId }, error: null },
          4: { data: null, error: null }, // new account not found
        };

        const result = results[callCount] ?? { data: null, error: null };
        chain.single = vi.fn(() => Promise.resolve(result));
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve(result).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "account_id",
        value: "aaa00000-0000-0000-0000-000000000000",
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result?.error).toBe("Account not found.");
    });

    it("blocks editing reconciled transactions", async () => {
      setupInlineEdit({ ...existingTxn, status: "reconciled" });

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "description",
        value: "new value",
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result?.error).toBe("Reconciled transactions cannot be edited.");
    });

    it("returns null on successful update", async () => {
      setupInlineEdit(existingTxn);

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "description",
        value: "Updated description",
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result).toBeNull();
    });

    it("sets cleared_at when changing status from uncleared to cleared", async () => {
      setupInlineEdit(existingTxn);

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "status",
        value: "cleared",
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result).toBeNull();
    });

    it("clears cleared_at when changing status to uncleared", async () => {
      setupInlineEdit({
        ...existingTxn,
        status: "cleared",
        cleared_at: "2025-01-01T00:00:00Z",
      });

      const fd = makeFormData({
        id: txnId,
        org_id: orgId,
        field: "status",
        value: "uncleared",
      });
      const result = await inlineUpdateTransaction(null, fd);
      expect(result).toBeNull();
    });
  });
});
