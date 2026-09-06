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
  createCategory,
  updateCategory,
  deactivateCategory,
  mergeCategory,
} from "./actions";

const mockedCreateClient = vi.mocked(createClient);
const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const catId = "770e8400-e29b-41d4-a716-446655440000";
const parentCatId = "880e8400-e29b-41d4-a716-446655440000";
const targetCatId = "990e8400-e29b-41d4-a716-446655440000";

describe("category actions", () => {
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

  describe("createCategory", () => {
    it("returns validation error for empty name", async () => {
      const fd = makeFormData({
        organization_id: orgId,
        name: "",
      });
      const result = await createCategory(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("returns error when not signed in", async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: null,
      } as never);

      const fd = makeFormData({
        organization_id: orgId,
        name: "Donations",
      });
      const result = await createCategory(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("accepts a parent regardless of the direction its transactions take", async () => {
      // Sequence: org check, parent check, insert.
      // The parent lookup no longer inspects any type column: a category has
      // no inherent direction, so any active parent in the org is eligible.
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          // org check
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else if (callCount === 2) {
          // parent category check
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: { id: parentCatId, organization_id: orgId },
              error: null,
            })
          );
        } else {
          // insert
          chain.single = vi.fn(() => Promise.resolve({ data: { id: catId }, error: null }));
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
        organization_id: orgId,
        name: "Individual",
        parent_id: parentCatId,
      });

      await expect(createCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
    });

    it("returns error when the parent category is not found", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else {
          chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
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
        organization_id: orgId,
        name: "Individual",
        parent_id: parentCatId,
      });
      const result = await createCategory(null, fd);
      expect(result?.error).toBe("Parent category not found.");
    });

    it("maps a 23505 unique-name collision to a friendly message", async () => {
      // The migration adds idx_categories_unique_active_name; without this
      // mapping a treasurer who reuses a name gets "Please try again." forever.
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else {
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: null,
              error: {
                code: "23505",
                message:
                  'duplicate key value violates unique constraint "idx_categories_unique_active_name"',
              },
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
        organization_id: orgId,
        name: "Poinsettias",
        parent_id: "",
      });
      const result = await createCategory(null, fd);
      expect(result?.error).toBe(
        "A category with that name already exists here. Pick a different name."
      );
    });

    it("leaves unrelated insert failures on the generic message", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else {
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { code: "42501", message: "permission denied for table categories" },
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
        organization_id: orgId,
        name: "Poinsettias",
        parent_id: "",
      });
      const result = await createCategory(null, fd);
      expect(result?.error).toBe("Failed to create category. Please try again.");
    });

    it("redirects on success", async () => {
      mockSupabase.mockResult({ data: { id: catId }, error: null });

      const fd = makeFormData({
        organization_id: orgId,
        name: "Donations",
        parent_id: "",
      });

      try {
        await createCategory(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toContain(`/categories/${catId}`);
      }
    });
  });

  describe("updateCategory", () => {
    it("returns validation error for invalid id", async () => {
      const fd = makeFormData({
        id: "not-uuid",
        organization_id: orgId,
        name: "Test",
      });
      const result = await updateCategory(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("returns error when category not found", async () => {
      // Sequence: org check succeeds, category check fails
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else {
          chain.single = vi.fn(() => Promise.resolve({ data: null, error: null }));
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
        id: catId,
        organization_id: orgId,
        name: "Updated",
      });
      const result = await updateCategory(null, fd);
      expect(result?.error).toBe("Category not found.");
    });

    it("maps a 23505 unique-name collision on rename to a friendly message", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else if (callCount === 2) {
          chain.single = vi.fn(() =>
            Promise.resolve({ data: { id: catId, parent_id: null }, error: null })
          );
        } else {
          // the UPDATE itself resolves through `then`, not `single`
          Object.defineProperty(chain, "then", {
            value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
              Promise.resolve({
                data: null,
                error: {
                  code: "23505",
                  message:
                    'duplicate key value violates unique constraint "idx_categories_unique_active_name"',
                },
              }).then(resolve, reject),
            writable: true,
            configurable: true,
          });
          return chain;
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
        id: catId,
        organization_id: orgId,
        name: "Poinsettias",
      });
      const result = await updateCategory(null, fd);
      expect(result?.error).toBe(
        "A category with that name already exists here. Pick a different name."
      );
    });

    it("renames a parent without consulting its subcategories", async () => {
      // There is no type to keep in sync any more, so the update writes the
      // name and redirects without ever reading the children.
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          // org check
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else if (callCount === 2) {
          // current category check - it's a parent (no parent_id)
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: { id: catId, parent_id: null },
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
        id: catId,
        organization_id: orgId,
        name: "Changed Parent",
      });

      await expect(updateCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
      // org check + current category fetch + the update itself; no children read
      expect(mockSupabase.from).toHaveBeenCalledTimes(3);
    });
  });

  describe("deactivateCategory", () => {
    it("returns error for missing fields", async () => {
      const fd = makeFormData({ id: "", organization_id: "" });
      const result = await deactivateCategory(null, fd);
      expect(result?.error).toContain("required");
    });

    it("blocks deactivation when line items exist", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          // org check
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else if (callCount === 2) {
          // line items count check
          Object.defineProperty(chain, "then", {
            value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null, count: 5 }).then(resolve, reject),
            writable: true,
            configurable: true,
          });
          return chain;
        }

        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({ id: catId, organization_id: orgId });
      const result = await deactivateCategory(null, fd);
      expect(result?.error).toContain("5 transaction line items");
    });

    it("blocks deactivation when active subcategories exist", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          // org check
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else if (callCount === 2) {
          // line items count - none
          Object.defineProperty(chain, "then", {
            value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject),
            writable: true,
            configurable: true,
          });
          return chain;
        } else if (callCount === 3) {
          // children count - 2 active
          Object.defineProperty(chain, "then", {
            value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null, count: 2 }).then(resolve, reject),
            writable: true,
            configurable: true,
          });
          return chain;
        }

        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({ id: catId, organization_id: orgId });
      const result = await deactivateCategory(null, fd);
      expect(result?.error).toContain("2 active subcategories");
    });

    it("redirects on success", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        }

        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null, count: 0 }).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

      const fd = makeFormData({ id: catId, organization_id: orgId });

      try {
        await deactivateCategory(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toContain("/categories");
      }
    });
  });

  describe("mergeCategory", () => {
    it("prevents merging a category into itself", async () => {
      const fd = makeFormData({
        source_id: catId,
        target_id: catId,
        organization_id: orgId,
      });
      const result = await mergeCategory(null, fd);
      expect(result?.error).toContain("Cannot merge a category into itself");
    });

    it("merges a former income category into a former expense category", async () => {
      // Categories no longer carry a direction, so the RPC has no same-type
      // guard: merging the income "Poinsettias" into the expense
      // "Poinsettias" is exactly what this model is for.
      mockSupabase.mockResult({ data: { id: orgId }, error: null });
      mockSupabase.rpc.mockResolvedValue({
        data: {
          reassigned_line_items: 4,
          reassigned_template_line_items: 0,
          reassigned_budget_line_items: 1,
          merged_budget_line_items: 1,
          reassigned_fee_accounts: 0,
          cancelled_budget_line_items: 0,
        },
        error: null,
      } as never);

      const fd = makeFormData({
        source_id: catId,
        target_id: targetCatId,
        organization_id: orgId,
      });

      await expect(mergeCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
      expect(mockSupabase.rpc).toHaveBeenCalledWith("merge_categories", {
        p_source_id: catId,
        p_target_id: targetCatId,
        p_organization_id: orgId,
      });
    });

    it("returns RPC error when source has active subcategories", async () => {
      mockSupabase.mockResult({ data: { id: orgId }, error: null });
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Cannot merge a parent category that has active subcategories. Deactivate or merge its subcategories first." },
      } as never);

      const fd = makeFormData({
        source_id: catId,
        target_id: targetCatId,
        organization_id: orgId,
      });
      const result = await mergeCategory(null, fd);
      expect(result?.error).toContain("active subcategories");
    });

    it("redirects on successful merge via RPC", async () => {
      mockSupabase.mockResult({ data: { id: orgId }, error: null });
      mockSupabase.rpc.mockResolvedValue({
        data: { reassigned_line_items: 5 },
        error: null,
      } as never);

      const fd = makeFormData({
        source_id: catId,
        target_id: targetCatId,
        organization_id: orgId,
      });

      try {
        await mergeCategory(null, fd);
      } catch (err) {
        expect(err).toBeInstanceOf(RedirectError);
        expect((err as RedirectError).url).toContain(`/categories/${targetCatId}`);
      }
    });
  });

  describe("primary_direction persistence", () => {
    const CHAIN_METHODS = [
      "select", "insert", "update", "delete", "eq", "in", "is", "order", "limit",
    ];

    function makeChain(): Record<string, ReturnType<typeof vi.fn>> {
      const chain: Record<string, ReturnType<typeof vi.fn>> = {};
      for (const m of CHAIN_METHODS) chain[m] = vi.fn(() => chain);
      Object.defineProperty(chain, "then", {
        value: (
          resolve?: (v: unknown) => unknown,
          reject?: (r: unknown) => unknown
        ) => Promise.resolve({ data: null, error: null }).then(resolve, reject),
        writable: true,
        configurable: true,
      });
      return chain;
    }

    /** Sequence for createCategory without a parent: org check, then insert. */
    function captureInsert() {
      const insertSpy = vi.fn();
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain = makeChain();
        if (callCount === 1) {
          chain.single = vi.fn(() =>
            Promise.resolve({ data: { id: orgId }, error: null })
          );
        } else {
          chain.insert = vi.fn((payload: unknown) => {
            insertSpy(payload);
            return chain;
          });
          chain.single = vi.fn(() =>
            Promise.resolve({ data: { id: catId }, error: null })
          );
        }
        return chain;
      });
      return insertSpy;
    }

    /** Sequence for updateCategory: org check, current category, then update. */
    function captureUpdate() {
      const updateSpy = vi.fn();
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain = makeChain();
        if (callCount === 1) {
          chain.single = vi.fn(() =>
            Promise.resolve({ data: { id: orgId }, error: null })
          );
        } else if (callCount === 2) {
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: { id: catId, parent_id: null },
              error: null,
            })
          );
        } else {
          chain.update = vi.fn((payload: unknown) => {
            updateSpy(payload);
            return chain;
          });
        }
        return chain;
      });
      return updateSpy;
    }

    it("writes the selected direction on create", async () => {
      const insertSpy = captureInsert();
      const fd = makeFormData({
        organization_id: orgId,
        name: "Fundraisers",
        primary_direction: "income",
      });

      await expect(createCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ primary_direction: "income" })
      );
    });

    it("writes null when the direction is left unset", async () => {
      const insertSpy = captureInsert();
      const fd = makeFormData({
        organization_id: orgId,
        name: "Undecided",
        primary_direction: "",
      });

      await expect(createCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ primary_direction: null })
      );
    });

    it("writes null when the field is absent entirely", async () => {
      const insertSpy = captureInsert();
      const fd = makeFormData({ organization_id: orgId, name: "No Field" });

      await expect(createCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
      expect(insertSpy).toHaveBeenCalledWith(
        expect.objectContaining({ primary_direction: null })
      );
    });

    it("rejects a value outside the allowed set", async () => {
      const fd = makeFormData({
        organization_id: orgId,
        name: "Bad",
        primary_direction: "both",
      });

      const result = await createCategory(null, fd);
      expect(result?.error).toBeDefined();
    });

    it("updates the direction on an existing category", async () => {
      const updateSpy = captureUpdate();
      const fd = makeFormData({
        id: catId,
        organization_id: orgId,
        name: "Transfer",
        primary_direction: "neither",
      });

      await expect(updateCategory(null, fd)).rejects.toBeInstanceOf(
        RedirectError
      );
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ primary_direction: "neither" })
      );
    });
  });
});
