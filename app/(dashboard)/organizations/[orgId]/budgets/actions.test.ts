import { describe, it, expect, vi, beforeEach } from "vitest";

import { createMockSupabaseClient } from "@/test/mocks/supabase";

import type { MockSupabaseClient } from "@/test/mocks/supabase";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("NEXT_REDIRECT");
  }),
}));

import { createClient } from "@/lib/supabase/server";
import { createBudget, updateBudget } from "./actions";

const mockedCreateClient = vi.mocked(createClient);

const userId = "550e8400-e29b-41d4-a716-446655440000";
const orgId = "660e8400-e29b-41d4-a716-446655440000";
const budgetId = "770e8400-e29b-41d4-a716-446655440000";

// Three-level category chain: grandparent -> middle -> grandchild.
// The middle category is NOT included in the budget, only the grandparent
// and the grandchild are — this is the case a one-level parent/child guard
// misses.
const grandparentId = "880e8400-e29b-41d4-a716-446655440000";
const middleId = "990e8400-e29b-41d4-a716-446655440000";
const grandchildId = "aa0e8400-e29b-41d4-a716-446655440000";

function makeFormData(data: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [key, val] of Object.entries(data)) {
    fd.set(key, val);
  }
  return fd;
}

const overlappingLineItems = JSON.stringify([
  { category_id: grandparentId, amount: 5000 },
  { category_id: grandchildId, amount: 1200 },
]);

const fullCategoryTree = [
  { id: grandparentId, parent_id: null },
  { id: middleId, parent_id: grandparentId },
  { id: grandchildId, parent_id: middleId },
];

describe("budget actions — category overlap guard", () => {
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

  describe("createBudget", () => {
    it("rejects a grandparent and grandchild budgeted together even though the middle category is unbudgeted", async () => {
      mockSupabase.mockChain().sequence([
        // organization lookup
        { data: { id: orgId }, error: null },
        // budgeted categories (only grandparent + grandchild)
        {
          data: [
            {
              id: grandparentId,
              organization_id: orgId,
              is_active: true,
              parent_id: null,
            },
            {
              id: grandchildId,
              organization_id: orgId,
              is_active: true,
              parent_id: middleId,
            },
          ],
          error: null,
        },
        // full org category tree, including the unbudgeted middle category
        { data: fullCategoryTree, error: null },
      ]);

      const fd = makeFormData({
        organization_id: orgId,
        name: "FY26 Budget",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        status: "draft",
        line_items: overlappingLineItems,
      });

      const result = await createBudget(null, fd);

      expect(result).toEqual({
        error:
          "A budget cannot include both a parent category and its subcategory. Budget at one level only.",
      });
    });

    // Guards that the overlap check is not a rubber stamp: a
    // findCategoryOverlapError that returned its error unconditionally would
    // pass every test above without ever letting a valid budget through.
    // This case has a single, non-overlapping category and must reach the
    // insert (observed here as the redirect after a successful create).
    it("creates the budget when there is no category overlap", async () => {
      const soleCategoryId = "bb0e8400-e29b-41d4-a716-446655440000";

      mockSupabase.mockChain().sequence([
        // organization lookup
        { data: { id: orgId }, error: null },
        // category validation (exists, active, correct org)
        {
          data: [
            {
              id: soleCategoryId,
              organization_id: orgId,
              is_active: true,
              parent_id: null,
            },
          ],
          error: null,
        },
        // full org category tree for the overlap check — no ancestor/descendant pair
        { data: [{ id: soleCategoryId, parent_id: null }], error: null },
        // budget insert
        { data: { id: budgetId }, error: null },
        // budget line item insert
        { data: null, error: null },
      ]);

      const fd = makeFormData({
        organization_id: orgId,
        name: "FY26 Budget",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        status: "draft",
        line_items: JSON.stringify([
          { category_id: soleCategoryId, amount: 5000 },
        ]),
      });

      await expect(createBudget(null, fd)).rejects.toThrow("NEXT_REDIRECT");
    });
  });

  describe("updateBudget", () => {
    it("rejects a grandparent and grandchild budgeted together even though the middle category is unbudgeted", async () => {
      mockSupabase.mockChain().sequence([
        // existing budget lookup
        { data: { id: budgetId, organization_id: orgId }, error: null },
        // organization lookup
        { data: { id: orgId }, error: null },
        // budgeted categories (only grandparent + grandchild)
        {
          data: [
            {
              id: grandparentId,
              organization_id: orgId,
              is_active: true,
              parent_id: null,
            },
            {
              id: grandchildId,
              organization_id: orgId,
              is_active: true,
              parent_id: middleId,
            },
          ],
          error: null,
        },
        // full org category tree, including the unbudgeted middle category
        { data: fullCategoryTree, error: null },
      ]);

      const fd = makeFormData({
        id: budgetId,
        organization_id: orgId,
        name: "FY26 Budget",
        start_date: "2026-01-01",
        end_date: "2026-12-31",
        status: "draft",
        line_items: overlappingLineItems,
      });

      const result = await updateBudget(null, fd);

      expect(result).toEqual({
        error:
          "A budget cannot include both a parent category and its subcategory. Budget at one level only.",
      });
    });
  });
});
