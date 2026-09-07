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
import { createSponsorship, updateSponsorship, deleteSponsorship } from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const levelId = "880e8400-e29b-41d4-a716-446655440000";
const sponsorId = "770e8400-e29b-41d4-a716-446655440000";
const sponsorshipId = "aa0e8400-e29b-41d4-a716-446655440000";
const transactionId = "bb0e8400-e29b-41d4-a716-446655440000";

describe("sponsorship actions", () => {
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

  function validSponsorshipForm(overrides: Record<string, string> = {}) {
    return makeFormData({
      id: sponsorshipId,
      organization_id: orgId,
      sponsor_id: sponsorId,
      level_id: levelId,
      term_start_date: "2026-07-01",
      term_end_date: "2027-06-30",
      amount: "500",
      payment_method: "check",
      check_number: "1043",
      received_date: "2026-08-14",
      notes: "",
      ...overrides,
    });
  }

  it("refuses to change the amount of a sponsorship that has been deposited", async () => {
    mockSupabase.mockChain().sequence([
      { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
      {
        data: {
          id: sponsorshipId,
          sponsor_id: sponsorId,
          amount: 500,
          level_id: levelId,
          payment_method: "check",
          transaction_id: transactionId,
          sponsors: { organization_id: orgId },
        },
        error: null,
      },
    ]);

    const result = await updateSponsorship(null, validSponsorshipForm({ amount: "750" }));

    expect(result?.error).toMatch(/already been deposited/i);
  });

  it("refuses to re-point a deposited sponsorship at a different sponsor", async () => {
    // Regression test for locking sponsor_id on a deposited sponsorship: the
    // posted ledger line's memo names the original sponsor, so re-pointing
    // sponsor_id after deposit would leave the line and the record
    // disagreeing about who actually sponsored it.
    const otherSponsorId = "990e8400-e29b-41d4-a716-446655440000";
    mockSupabase.mockChain().sequence([
      { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
      {
        data: {
          id: sponsorshipId,
          sponsor_id: sponsorId,
          amount: 500,
          level_id: levelId,
          payment_method: "check",
          transaction_id: transactionId,
          sponsors: { organization_id: orgId },
        },
        error: null,
      },
    ]);

    const result = await updateSponsorship(
      null,
      validSponsorshipForm({ sponsor_id: otherSponsorId })
    );

    expect(result?.error).toMatch(/already been deposited/i);
  });

  it("allows editing notes on a deposited sponsorship", async () => {
    mockSupabase.mockChain().sequence([
      { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
      {
        data: {
          id: sponsorshipId,
          sponsor_id: sponsorId,
          amount: 500,
          level_id: levelId,
          payment_method: "check",
          transaction_id: transactionId,
          sponsors: { organization_id: orgId },
        },
        error: null,
      },
      { data: { id: sponsorId }, error: null },
      { data: { id: levelId }, error: null },
      { data: null, error: null },
    ]);

    await expect(
      updateSponsorship(null, validSponsorshipForm({ notes: "Renewed by phone" }))
    ).rejects.toThrow(RedirectError);
  });

  it("rejects an update whose submitted sponsor_id does not belong to the organization", async () => {
    mockSupabase.mockChain().sequence([
      { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
      {
        data: {
          id: sponsorshipId,
          sponsor_id: sponsorId,
          amount: 500,
          level_id: levelId,
          payment_method: "check",
          transaction_id: null,
          sponsors: { organization_id: orgId },
        },
        error: null,
      },
      // The submitted sponsor_id doesn't resolve within this org.
      { data: null, error: null },
    ]);

    const updateChainCallsBefore = mockSupabase.from.mock.calls.length;

    const result = await updateSponsorship(null, validSponsorshipForm());

    expect(result?.error).toMatch(/sponsor not found/i);
    // Exactly org lookup + existing-row lookup + sponsor lookup — the
    // update itself must never be reached.
    expect(mockSupabase.from.mock.calls.length).toBe(updateChainCallsBefore + 3);
  });

  it("refuses to delete a sponsorship that has been deposited", async () => {
    mockSupabase.mockChain().sequence([
      { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
      {
        data: { id: sponsorshipId, transaction_id: transactionId, sponsors: { organization_id: orgId } },
        error: null,
      },
    ]);

    const result = await deleteSponsorship(
      null,
      makeFormData({ id: sponsorshipId, organization_id: orgId })
    );

    expect(result?.error).toMatch(/deposit/i);
  });

  it("rejects a sponsorship whose sponsor belongs to another organization", async () => {
    mockSupabase.mockChain().sequence([
      { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
      { data: null, error: null },
    ]);

    const result = await createSponsorship(null, validSponsorshipForm());

    expect(result?.error).toMatch(/sponsor not found/i);
  });
});
