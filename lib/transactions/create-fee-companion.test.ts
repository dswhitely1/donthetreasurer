import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";
import { createFeeCompanionTransaction } from "./create-fee-companion";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

const accountId = "cc0e8400-e29b-41d4-a716-446655440000";
const feeCategoryId = "dd0e8400-e29b-41d4-a716-446655440000";

describe("createFeeCompanionTransaction", () => {
  let mockSupabase: MockSupabaseClient;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
  });

  function input(overrides: Record<string, unknown> = {}) {
    return {
      account: {
        id: accountId,
        fee_percentage: 2.9,
        fee_flat_amount: 0.3,
        fee_category_id: feeCategoryId,
      },
      amount: 100,
      transactionDate: "2026-08-14",
      description: "Sponsorship deposit",
      status: "uncleared" as const,
      clearedAt: null,
      ...overrides,
    };
  }

  it("does nothing when the account has no fee category", async () => {
    const result = await createFeeCompanionTransaction(
      mockSupabase as never,
      input({ account: { id: accountId, fee_percentage: 2.9, fee_flat_amount: null, fee_category_id: null } })
    );

    expect(result).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("does nothing when the account has a category but no fee rates", async () => {
    const result = await createFeeCompanionTransaction(
      mockSupabase as never,
      input({ account: { id: accountId, fee_percentage: null, fee_flat_amount: null, fee_category_id: feeCategoryId } })
    );

    expect(result).toBeNull();
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("skips the companion when the fee category has been deactivated", async () => {
    mockSupabase.mockResult({ data: { id: feeCategoryId, is_active: false }, error: null });

    const result = await createFeeCompanionTransaction(mockSupabase as never, input());

    expect(result).toBeNull();
    // The single shared terminalResult resolves every chain identically, so a
    // vacuous assertion here (just `result` is null) would still pass even if
    // the `is_active` guard were deleted and the companion transaction/line
    // item insert both ran through to completion. Pinning the call count to
    // exactly the categories lookup makes the guard load-bearing: with it
    // removed, two more `from()` calls (transactions, transaction_line_items)
    // would happen and this assertion would fail.
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith("categories");
  });

  it("creates an expense transaction for the computed fee", async () => {
    const inserts: unknown[] = [];
    // The shared mock's `from` is typed with no parameters (it never needs
    // one elsewhere); cast the whole implementation rather than widen that
    // shared type for one test.
    mockSupabase.from.mockImplementation(((table: string) => {
      if (table === "categories") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: feeCategoryId, is_active: true }, error: null }) }) }),
        } as never;
      }
      if (table === "transactions") {
        return {
          insert: (payload: unknown) => {
            inserts.push(payload);
            return { select: () => ({ single: () => Promise.resolve({ data: { id: "fee-txn" }, error: null }) }) };
          },
        } as never;
      }
      return {
        insert: (payload: unknown) => {
          inserts.push(payload);
          return Promise.resolve({ data: null, error: null });
        },
      } as never;
    }) as never);

    const result = await createFeeCompanionTransaction(mockSupabase as never, input());

    expect(result).toBeNull();
    expect(inserts[0]).toEqual(
      expect.objectContaining({
        account_id: accountId,
        amount: 3.2,
        transaction_type: "expense",
        description: "Processing fee: Sponsorship deposit",
      })
    );
    expect(inserts[1]).toEqual(
      expect.objectContaining({
        transaction_id: "fee-txn",
        category_id: feeCategoryId,
        amount: 3.2,
      })
    );
  });

  it("deletes the fee transaction and reports when its line item fails", async () => {
    const del = vi.fn(() => ({ eq: () => Promise.resolve({ data: null, error: null }) }));
    // See the cast note above: the shared mock's `from` takes no parameters.
    mockSupabase.from.mockImplementation(((table: string) => {
      if (table === "categories") {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { id: feeCategoryId, is_active: true }, error: null }) }) }),
        } as never;
      }
      if (table === "transactions") {
        return {
          insert: () => ({ select: () => ({ single: () => Promise.resolve({ data: { id: "fee-txn" }, error: null }) }) }),
          delete: del,
        } as never;
      }
      return {
        insert: () => Promise.resolve({ data: null, error: { message: "boom" } }),
      } as never;
    }) as never);

    const result = await createFeeCompanionTransaction(mockSupabase as never, input());

    expect(del).toHaveBeenCalled();
    expect(result?.error).toMatch(/processing fee/i);
  });
});
