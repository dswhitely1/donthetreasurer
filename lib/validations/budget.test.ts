import { describe, it, expect } from "vitest";

import { budgetLineItemSchema } from "./budget";

const validCategoryId = "3f1e6c9a-0000-4000-8000-000000000001";

describe("budgetLineItemSchema", () => {
  it("accepts a positive net amount", () => {
    const result = budgetLineItemSchema.safeParse({
      category_id: validCategoryId,
      amount: 500,
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a negative net amount", () => {
    const result = budgetLineItemSchema.safeParse({
      category_id: validCategoryId,
      amount: -4650,
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a zero amount", () => {
    const result = budgetLineItemSchema.safeParse({
      category_id: validCategoryId,
      amount: 0,
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an invalid category ID", () => {
    const result = budgetLineItemSchema.safeParse({
      category_id: "not-a-uuid",
      amount: 100,
      notes: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty notes", () => {
    const result = budgetLineItemSchema.safeParse({
      category_id: validCategoryId,
      amount: 100,
      notes: "",
    });
    expect(result.success).toBe(true);
  });
});
