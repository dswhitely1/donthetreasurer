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
import { createSponsor, deleteSponsor } from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const sponsorId = "770e8400-e29b-41d4-a716-446655440000";

describe("sponsor actions", () => {
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

  it("rejects a sponsor when sponsor tracking is disabled", async () => {
    mockSupabase.mockResult({
      data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: false },
      error: null,
    });

    const result = await createSponsor(
      null,
      makeFormData({ organization_id: orgId, name: "Acme Hardware" })
    );

    expect(result).toEqual({ error: "Sponsor tracking is not enabled." });
  });

  it("returns a validation error for an empty sponsor name", async () => {
    const result = await createSponsor(
      null,
      makeFormData({ organization_id: orgId, name: "" })
    );

    expect(result?.error).toMatch(/name is required/i);
  });

  it("stores blank optional fields as null rather than empty strings", async () => {
    const insert = vi.fn(() => Promise.resolve({ data: null, error: null }));
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
      return { insert } as never;
    }) as never);

    await expect(
      createSponsor(
        null,
        makeFormData({ organization_id: orgId, name: "Acme Hardware", email: "" })
      )
    ).rejects.toThrow(RedirectError);

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Acme Hardware", email: null, city: null })
    );
  });

  it("explains that a sponsor with sponsorship history cannot be deleted", async () => {
    mockSupabase
      .mockChain()
      .sequence([
        { data: { id: orgId, name: "CCV", fiscal_year_start_month: 7, sponsors_enabled: true }, error: null },
        { data: null, error: { message: "violates foreign key constraint", code: "23503" } },
      ]);

    const result = await deleteSponsor(
      null,
      makeFormData({ id: sponsorId, organization_id: orgId })
    );

    expect(result?.error).toMatch(/sponsorship history/i);
  });
});
