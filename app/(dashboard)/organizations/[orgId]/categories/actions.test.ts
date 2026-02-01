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
        category_type: "income",
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
        category_type: "income",
      });
      const result = await createCategory(null, fd);
      expect(result).toEqual({ error: "You must be signed in." });
    });

    it("returns error when parent type doesn't match", async () => {
      // Sequence: org check, parent check
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
          // parent category check - different type
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: {
                id: parentCatId,
                category_type: "expense",
                organization_id: orgId,
              },
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
        organization_id: orgId,
        name: "Individual",
        category_type: "income",
        parent_id: parentCatId,
      });
      const result = await createCategory(null, fd);
      expect(result?.error).toContain("must match parent");
    });

    it("redirects on success", async () => {
      mockSupabase.mockResult({ data: { id: catId }, error: null });

      const fd = makeFormData({
        organization_id: orgId,
        name: "Donations",
        category_type: "income",
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
        category_type: "income",
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
        category_type: "income",
      });
      const result = await updateCategory(null, fd);
      expect(result?.error).toBe("Category not found.");
    });

    it("blocks type change when children have different type", async () => {
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
              data: { id: catId, parent_id: null, category_type: "income" },
              error: null,
            })
          );
        } else if (callCount === 3) {
          // children check - children have mismatched type
          Object.defineProperty(chain, "then", {
            value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
              Promise.resolve({
                data: [{ id: "child1", category_type: "income" }],
                error: null,
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
        name: "Changed Parent",
        category_type: "expense", // changing from income to expense
      });
      const result = await updateCategory(null, fd);
      expect(result?.error).toContain("Cannot change type");
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

    it("returns error when types don't match", async () => {
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
          // source category
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: {
                id: catId,
                parent_id: null,
                category_type: "income",
                is_active: true,
              },
              error: null,
            })
          );
        } else if (callCount === 3) {
          // target category - different type
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: {
                id: targetCatId,
                parent_id: null,
                category_type: "expense",
                is_active: true,
              },
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
        source_id: catId,
        target_id: targetCatId,
        organization_id: orgId,
      });
      const result = await mergeCategory(null, fd);
      expect(result?.error).toContain("same type");
    });

    it("blocks merging categories at different levels", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else if (callCount === 2) {
          // source: parent (no parent_id)
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: { id: catId, parent_id: null, category_type: "income", is_active: true },
              error: null,
            })
          );
        } else if (callCount === 3) {
          // target: child (has parent_id)
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: { id: targetCatId, parent_id: parentCatId, category_type: "income", is_active: true },
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
        source_id: catId,
        target_id: targetCatId,
        organization_id: orgId,
      });
      const result = await mergeCategory(null, fd);
      expect(result?.error).toContain("same level");
    });

    it("reparents subcategories and redirects on success (parent merge)", async () => {
      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        const chain: Record<string, ReturnType<typeof vi.fn>> = {};
        const methods = ["select", "insert", "update", "delete", "eq", "in", "is", "order", "limit"];
        for (const m of methods) chain[m] = vi.fn(() => chain);

        if (callCount === 1) {
          chain.single = vi.fn(() => Promise.resolve({ data: { id: orgId }, error: null }));
        } else if (callCount === 2) {
          // source: parent
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: { id: catId, parent_id: null, category_type: "income", is_active: true },
              error: null,
            })
          );
        } else if (callCount === 3) {
          // target: parent
          chain.single = vi.fn(() =>
            Promise.resolve({
              data: { id: targetCatId, parent_id: null, category_type: "income", is_active: true },
              error: null,
            })
          );
        }

        // All subsequent calls succeed
        Object.defineProperty(chain, "then", {
          value: (resolve?: (v: unknown) => unknown, reject?: (r: unknown) => unknown) =>
            Promise.resolve({ data: null, error: null }).then(resolve, reject),
          writable: true,
          configurable: true,
        });

        return chain;
      });

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
});
