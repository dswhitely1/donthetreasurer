import { describe, it, expect } from "vitest";

import {
  createCategorySchema,
  updateCategorySchema,
  mergeCategorySchema,
  CATEGORY_TYPES,
  CATEGORY_TYPE_LABELS,
} from "./category";

const validOrgId = "550e8400-e29b-41d4-a716-446655440000";
const validCatId = "660e8400-e29b-41d4-a716-446655440000";

describe("CATEGORY_TYPES and CATEGORY_TYPE_LABELS", () => {
  it("has income and expense types", () => {
    expect(CATEGORY_TYPES).toEqual(["income", "expense"]);
  });

  it("has labels for every type", () => {
    for (const type of CATEGORY_TYPES) {
      expect(CATEGORY_TYPE_LABELS[type]).toBeDefined();
    }
  });
});

describe("createCategorySchema", () => {
  it("accepts valid input without parent_id", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Donations",
      category_type: "income",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with parent_id", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Individual Donations",
      category_type: "income",
      parent_id: validCatId,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for parent_id", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Operations",
      category_type: "expense",
      parent_id: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "",
      category_type: "income",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "A".repeat(101),
      category_type: "income",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category type", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      category_type: "other",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid parent_id format", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      category_type: "income",
      parent_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts both income and expense types", () => {
    for (const type of CATEGORY_TYPES) {
      const result = createCategorySchema.safeParse({
        organization_id: validOrgId,
        name: "Test",
        category_type: type,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe("updateCategorySchema", () => {
  it("requires a valid UUID id", () => {
    const result = updateCategorySchema.safeParse({
      id: "not-uuid",
      organization_id: validOrgId,
      name: "Test",
      category_type: "income",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid update input", () => {
    const result = updateCategorySchema.safeParse({
      id: validCatId,
      organization_id: validOrgId,
      name: "Updated Category",
      category_type: "expense",
    });
    expect(result.success).toBe(true);
  });
});

describe("mergeCategorySchema", () => {
  const targetId = "770e8400-e29b-41d4-a716-446655440000";

  it("accepts valid merge input", () => {
    const result = mergeCategorySchema.safeParse({
      source_id: validCatId,
      target_id: targetId,
      organization_id: validOrgId,
    });
    expect(result.success).toBe(true);
  });

  it("prevents merging a category into itself", () => {
    const result = mergeCategorySchema.safeParse({
      source_id: validCatId,
      target_id: validCatId,
      organization_id: validOrgId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid source_id", () => {
    const result = mergeCategorySchema.safeParse({
      source_id: "not-uuid",
      target_id: targetId,
      organization_id: validOrgId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid target_id", () => {
    const result = mergeCategorySchema.safeParse({
      source_id: validCatId,
      target_id: "not-uuid",
      organization_id: validOrgId,
    });
    expect(result.success).toBe(false);
  });
});
