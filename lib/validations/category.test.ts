import { describe, it, expect } from "vitest";

import {
  createCategorySchema,
  updateCategorySchema,
  mergeCategorySchema,
} from "./category";

const validOrgId = "550e8400-e29b-41d4-a716-446655440000";
const validCatId = "660e8400-e29b-41d4-a716-446655440000";

describe("createCategorySchema", () => {
  it("accepts valid input without parent_id", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Donations",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid input with parent_id", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Individual Donations",
      parent_id: validCatId,
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for parent_id", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Operations",
      parent_id: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid parent_id format", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      parent_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("carries no category type — direction comes from the transaction", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Poinsettias",
      category_type: "income",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data).not.toHaveProperty("category_type");
  });

  it("accepts the same name whether it is used for income or expense", () => {
    const result = createCategorySchema.safeParse({
      organization_id: validOrgId,
      name: "Poinsettias",
    });
    expect(result.success).toBe(true);
    expect(result.success && result.data.name).toBe("Poinsettias");
  });
});

describe("updateCategorySchema", () => {
  it("requires a valid UUID id", () => {
    const result = updateCategorySchema.safeParse({
      id: "not-uuid",
      organization_id: validOrgId,
      name: "Test",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid update input", () => {
    const result = updateCategorySchema.safeParse({
      id: validCatId,
      organization_id: validOrgId,
      name: "Updated Category",
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
