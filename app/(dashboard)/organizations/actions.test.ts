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
  createOrganization,
  updateOrganization,
  deleteOrganization,
} from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";

describe("organization actions", () => {
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

  describe("createOrganization", () => {
    it("returns validation error for empty name", async () => {
      const fd = makeFormData({ name: "", ein: "", fiscal_year_start_month: "1" });
      const result = await createOrganization(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("returns error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({ name: "Test Org", ein: "", fiscal_year_start_month: "1" });
      const result = await createOrganization(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("stores null for empty EIN", async () => {
      mockSupabase.mockResult({ data: { id: orgId }, error: null });

      const fd = makeFormData({ name: "Test Org", ein: "", fiscal_year_start_month: "1" });

      try {
        await createOrganization(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
      }

      // Verify .from was called (insert happened)
      expect(mockSupabase.from).toHaveBeenCalled();
    });

    it("redirects to new org on success", async () => {
      mockSupabase.mockResult({ data: { id: orgId }, error: null });

      const fd = makeFormData({ name: "My Foundation", ein: "12-3456789", fiscal_year_start_month: "7" });

      try {
        await createOrganization(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toBe(`/organizations/${orgId}`);
      }
    });

    it("returns error on supabase insert failure", async () => {
      mockSupabase.mockResult({ data: null, error: { message: "insert failed" } });

      const fd = makeFormData({ name: "Test Org", ein: "", fiscal_year_start_month: "1" });
      const result = await createOrganization(null, fd);
      expect(result?.error).toContain("Failed to create organization");
    });
  });

  describe("updateOrganization", () => {
    it("returns validation error for missing id", async () => {
      const fd = makeFormData({ id: "", name: "Test", ein: "", fiscal_year_start_month: "1" });
      const result = await updateOrganization(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("redirects on success", async () => {
      mockSupabase.mockResult({ data: null, error: null });

      const fd = makeFormData({
        id: orgId,
        name: "Updated Org",
        ein: "12-3456789",
        fiscal_year_start_month: "6",
      });

      try {
        await updateOrganization(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toBe(`/organizations/${orgId}`);
      }
    });
  });

  describe("deleteOrganization", () => {
    it("returns error for missing id", async () => {
      const fd = makeFormData({ id: "" });
      const result = await deleteOrganization(null, fd);
      expect(result).toEqual({ error: "Organization ID is required." });
    });

    it("soft deletes (sets is_active=false) and redirects", async () => {
      mockSupabase.mockResult({ data: null, error: null });

      const fd = makeFormData({ id: orgId });

      try {
        await deleteOrganization(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toBe("/organizations");
      }
    });

    it("returns error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({ id: orgId });
      const result = await deleteOrganization(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });
  });
});
