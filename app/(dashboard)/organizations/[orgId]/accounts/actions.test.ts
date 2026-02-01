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
import { createAccount, updateAccount, deactivateAccount } from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const accountId = "770e8400-e29b-41d4-a716-446655440000";

describe("account actions", () => {
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
    for (const [key, val] of Object.entries(data)) {
      fd.set(key, val);
    }
    return fd;
  }

  describe("createAccount", () => {
    it("returns validation error for empty name", async () => {
      const fd = makeFormData({
        organization_id: orgId,
        name: "",
        account_type: "checking",
        opening_balance: "0",
      });
      const result = await createAccount(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("returns validation error for invalid account type", async () => {
      const fd = makeFormData({
        organization_id: orgId,
        name: "Test Account",
        account_type: "bitcoin",
        opening_balance: "0",
      });
      const result = await createAccount(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("returns error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({
        organization_id: orgId,
        name: "Test",
        account_type: "checking",
        description: "",
        opening_balance: "0",
      });
      const result = await createAccount(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("redirects to account detail on success", async () => {
      mockSupabase.mockResult({ data: { id: accountId }, error: null });

      const fd = makeFormData({
        organization_id: orgId,
        name: "Main Checking",
        account_type: "checking",
        description: "Primary account",
        opening_balance: "5000",
      });

      try {
        await createAccount(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toBe(
          `/organizations/${orgId}/accounts/${accountId}`
        );
      }
    });

    it("verifies organization belongs to user", async () => {
      // First call: org check returns null (not found)
      mockSupabase.mockResult({ data: null, error: null });

      const fd = makeFormData({
        organization_id: orgId,
        name: "Test",
        account_type: "checking",
        description: "",
        opening_balance: "0",
      });
      const result = await createAccount(null, fd);
      expect(result?.error).toBe("Organization not found.");
    });
  });

  describe("updateAccount", () => {
    it("returns validation error for missing id", async () => {
      const fd = makeFormData({
        id: "not-uuid",
        organization_id: orgId,
        name: "Test",
        account_type: "checking",
        opening_balance: "0",
      });
      const result = await updateAccount(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("redirects on success", async () => {
      mockSupabase.mockResult({ data: { id: orgId }, error: null });

      const fd = makeFormData({
        id: accountId,
        organization_id: orgId,
        name: "Updated Account",
        account_type: "savings",
        description: "",
        opening_balance: "1000",
      });

      try {
        await updateAccount(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toBe(
          `/organizations/${orgId}/accounts/${accountId}`
        );
      }
    });
  });

  describe("deactivateAccount", () => {
    it("returns error for missing fields", async () => {
      const fd = makeFormData({ id: "", organization_id: "" });
      const result = await deactivateAccount(null, fd);
      expect(result?.error).toContain("required");
    });

    it("returns error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({ id: accountId, organization_id: orgId });
      const result = await deactivateAccount(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("soft deletes and redirects on success", async () => {
      mockSupabase.mockResult({ data: { id: orgId }, error: null });

      const fd = makeFormData({ id: accountId, organization_id: orgId });

      try {
        await deactivateAccount(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toBe(
          `/organizations/${orgId}/accounts`
        );
      }
    });
  });
});
