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
import { createSponsorLevel, deleteSponsorLevel } from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const levelId = "880e8400-e29b-41d4-a716-446655440000";

describe("sponsor level actions", () => {
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

  it("rejects a level when sponsor tracking is disabled for the org", async () => {
    mockSupabase.mockResult({
      data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: false },
      error: null,
    });

    const result = await createSponsorLevel(
      null,
      makeFormData({ organization_id: orgId, name: "Gold", default_amount: "500" })
    );

    expect(result).toEqual({ error: "Sponsor tracking is not enabled." });
  });

  it("returns a validation error for an empty level name", async () => {
    const result = await createSponsorLevel(
      null,
      makeFormData({ organization_id: orgId, name: "", default_amount: "500" })
    );

    expect(result?.error).toMatch(/name is required/i);
  });

  it("explains that a level in use cannot be deleted", async () => {
    mockSupabase
      .mockChain()
      .sequence([
        { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
        { data: null, error: { message: "violates foreign key constraint", code: "23503" } },
      ]);

    const result = await deleteSponsorLevel(
      null,
      makeFormData({ id: levelId, organization_id: orgId })
    );

    expect(result?.error).toMatch(/in use/i);
  });

  it("redirects back to the levels page after a successful create", async () => {
    mockSupabase
      .mockChain()
      .sequence([
        { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
        { data: null, error: null },
      ]);

    await expect(
      createSponsorLevel(
        null,
        makeFormData({ organization_id: orgId, name: "Gold", default_amount: "500" })
      )
    ).rejects.toThrow(RedirectError);

    expect(mockRedirect).toHaveBeenCalledWith(
      `/organizations/${orgId}/sponsor-levels`
    );
  });
});
