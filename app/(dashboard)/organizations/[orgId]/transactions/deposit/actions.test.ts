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
import { createDepositFromQueue } from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";

describe("deposit actions", () => {
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

  function makeFormData(data: Record<string, string>): FormData {
    const fd = new FormData();
    for (const [key, val] of Object.entries(data)) fd.set(key, val);
    return fd;
  }

  const accountId = "cc0e8400-e29b-41d4-a716-446655440000";
  const categoryId = "990e8400-e29b-41d4-a716-446655440000";
  const sponsorshipA = "aa0e8400-e29b-41d4-a716-446655440000";
  const sponsorshipB = "ab0e8400-e29b-41d4-a716-446655440000";

  function depositForm(lines: unknown[], overrides: Record<string, string> = {}) {
    return makeFormData({
      organization_id: orgId,
      account_id: accountId,
      transaction_date: "2026-08-20",
      description: "Sponsorship deposit",
      status: "uncleared",
      lines: JSON.stringify(lines),
      ...overrides,
    });
  }

  function twoQueuedCheckSponsorships() {
    return [
      { id: sponsorshipA, amount: 500, payment_method: "check", transaction_id: null, sponsors: { organization_id: orgId, name: "Acme" }, sponsor_levels: { name: "Gold" } },
      { id: sponsorshipB, amount: 250, payment_method: "check", transaction_id: null, sponsors: { organization_id: orgId, name: "Baker" }, sponsor_levels: { name: "Silver" } },
    ];
  }

  /**
   * Wires `from()` per table for the deposit action's query sequence and
   * captures every write, so each test asserts on what was actually sent to
   * the database rather than on call counts.
   */
  function wireDeposit({
    sponsorships,
    claimedCount,
  }: {
    sponsorships: unknown[];
    claimedCount?: number;
  }) {
    const captured = {
      transactionInserts: [] as unknown[],
      lineItemInserts: [] as unknown[],
      deletedTransactionIds: [] as string[],
    };

    // The shared mock's `from` is typed with no parameters (it never needs
    // one elsewhere); cast the whole implementation rather than widen that
    // shared type for one test.
    mockSupabase.from.mockImplementation(((table: string) => {
      if (table === "organizations") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true },
                  error: null,
                }),
            }),
          }),
        } as never;
      }

      if (table === "accounts") {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  single: () =>
                    Promise.resolve({
                      data: {
                        id: accountId,
                        organization_id: orgId,
                        fee_percentage: null,
                        fee_flat_amount: null,
                        fee_category_id: null,
                      },
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        } as never;
      }

      if (table === "sponsorships") {
        return {
          select: () => ({
            in: () => ({ eq: () => Promise.resolve({ data: sponsorships, error: null }) }),
          }),
          update: () => ({
            in: () => ({
              is: () =>
                Promise.resolve({
                  count: claimedCount ?? sponsorships.length,
                  error: null,
                }),
            }),
            eq: () => Promise.resolve({ data: null, error: null }),
          }),
        } as never;
      }

      if (table === "categories") {
        return {
          select: () => ({
            in: () => ({
              eq: () => ({ eq: () => Promise.resolve({ data: [{ id: categoryId }], error: null }) }),
            }),
          }),
        } as never;
      }

      if (table === "transactions") {
        return {
          insert: (payload: unknown) => {
            captured.transactionInserts.push(payload);
            return {
              select: () => ({ single: () => Promise.resolve({ data: { id: "new-txn" }, error: null }) }),
            };
          },
          delete: () => ({
            eq: (_column: string, value: string) => {
              captured.deletedTransactionIds.push(value);
              return Promise.resolve({ data: null, error: null });
            },
          }),
        } as never;
      }

      return {
        insert: (payload: unknown) => {
          captured.lineItemInserts.push(payload);
          return Promise.resolve({ data: null, error: null });
        },
      } as never;
    }) as never);

    return captured;
  }

  it("rejects a deposit that mixes PayPal with cash or check", async () => {
    const captured = wireDeposit({
      sponsorships: [
        { id: sponsorshipA, amount: 500, payment_method: "check", transaction_id: null, sponsors: { organization_id: orgId, name: "Acme" }, sponsor_levels: { name: "Gold" } },
        { id: sponsorshipB, amount: 250, payment_method: "paypal", transaction_id: null, sponsors: { organization_id: orgId, name: "Baker" }, sponsor_levels: { name: "Silver" } },
      ],
    });

    const result = await createDepositFromQueue(
      null,
      depositForm([
        { sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" },
        { sponsorship_id: sponsorshipB, category_id: categoryId, memo: "Baker — Silver" },
      ])
    );

    expect(result?.error).toMatch(/PayPal/i);
    expect(captured.transactionInserts).toHaveLength(0);
  });

  it("rejects a sponsorship that is already on another deposit", async () => {
    const captured = wireDeposit({
      sponsorships: [
        { id: sponsorshipA, amount: 500, payment_method: "check", transaction_id: "existing-txn", sponsors: { organization_id: orgId, name: "Acme" }, sponsor_levels: { name: "Gold" } },
      ],
    });

    const result = await createDepositFromQueue(
      null,
      depositForm([{ sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" }])
    );

    expect(result?.error).toMatch(/already been deposited/i);
    expect(captured.transactionInserts).toHaveLength(0);
  });

  it("rejects a sponsorship id belonging to another organization", async () => {
    // The org filter on the query excludes it, so it simply is not returned.
    wireDeposit({ sponsorships: [] });

    const result = await createDepositFromQueue(
      null,
      depositForm([{ sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" }])
    );

    expect(result?.error).toMatch(/no longer in the queue/i);
  });

  it("computes the transaction amount from the database, not the form", async () => {
    const captured = wireDeposit({ sponsorships: twoQueuedCheckSponsorships() });

    await expect(
      createDepositFromQueue(
        null,
        depositForm([
          { sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" },
          { sponsorship_id: sponsorshipB, category_id: categoryId, memo: "Baker — Silver" },
        ])
      )
    ).rejects.toThrow(RedirectError);

    expect(captured.transactionInserts[0]).toEqual(
      expect.objectContaining({
        amount: 750,
        transaction_type: "income",
        account_id: accountId,
      })
    );
  });

  it("writes one line item per selected sponsorship", async () => {
    const captured = wireDeposit({ sponsorships: twoQueuedCheckSponsorships() });

    await expect(
      createDepositFromQueue(
        null,
        depositForm([
          { sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" },
          { sponsorship_id: sponsorshipB, category_id: categoryId, memo: "Baker — Silver" },
        ])
      )
    ).rejects.toThrow(RedirectError);

    expect(captured.lineItemInserts[0]).toEqual([
      expect.objectContaining({ amount: 500, category_id: categoryId, memo: "Acme — Gold" }),
      expect.objectContaining({ amount: 250, category_id: categoryId, memo: "Baker — Silver" }),
    ]);
  });

  it("rolls the transaction back when a sponsorship is claimed by a concurrent deposit", async () => {
    // Two lines selected, but only one row still had transaction_id IS NULL by
    // the time the claim ran — the other window won the race.
    const captured = wireDeposit({
      sponsorships: twoQueuedCheckSponsorships(),
      claimedCount: 1,
    });

    const result = await createDepositFromQueue(
      null,
      depositForm([
        { sponsorship_id: sponsorshipA, category_id: categoryId, memo: "Acme — Gold" },
        { sponsorship_id: sponsorshipB, category_id: categoryId, memo: "Baker — Silver" },
      ])
    );

    expect(result?.error).toMatch(/another window/i);
    expect(captured.deletedTransactionIds).toContain("new-txn");
  });
});
