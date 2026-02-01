import { describe, it, expect } from "vitest";

import {
  createAccountSchema,
  updateAccountSchema,
  calculateFee,
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
} from "./account";

const validOrgId = "550e8400-e29b-41d4-a716-446655440000";
const validCategoryId = "660e8400-e29b-41d4-a716-446655440000";

describe("ACCOUNT_TYPES and ACCOUNT_TYPE_LABELS", () => {
  it("has all five account types", () => {
    expect(ACCOUNT_TYPES).toEqual([
      "checking",
      "savings",
      "paypal",
      "cash",
      "other",
    ]);
  });

  it("has labels for every type", () => {
    for (const type of ACCOUNT_TYPES) {
      expect(ACCOUNT_TYPE_LABELS[type]).toBeDefined();
      expect(typeof ACCOUNT_TYPE_LABELS[type]).toBe("string");
    }
  });
});

describe("createAccountSchema", () => {
  it("accepts valid input", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Main Checking",
      account_type: "checking",
      opening_balance: "1000.50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.opening_balance).toBe(1000.5);
    }
  });

  it("defaults opening_balance to 0", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Cash",
      account_type: "cash",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.opening_balance).toBe(0);
    }
  });

  it("coerces opening_balance from string", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Savings",
      account_type: "savings",
      opening_balance: "250.75",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.opening_balance).toBe(250.75);
    }
  });

  it("rejects negative opening_balance", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      account_type: "checking",
      opening_balance: "-100",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing name", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "",
      account_type: "checking",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "A".repeat(101),
      account_type: "checking",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid account type", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      account_type: "bitcoin",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid account types", () => {
    for (const type of ACCOUNT_TYPES) {
      const result = createAccountSchema.safeParse({
        organization_id: validOrgId,
        name: "Test",
        account_type: type,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid organization_id", () => {
    const result = createAccountSchema.safeParse({
      organization_id: "not-uuid",
      name: "Test",
      account_type: "checking",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty string for description", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      account_type: "checking",
      description: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects description longer than 500 characters", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      account_type: "checking",
      description: "A".repeat(501),
    });
    expect(result.success).toBe(false);
  });

  // Fee config field tests
  it("accepts valid fee configuration", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "PayPal",
      account_type: "paypal",
      fee_percentage: "1.99",
      fee_flat_amount: "0.49",
      fee_category_id: validCategoryId,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fee_percentage).toBe(1.99);
      expect(result.data.fee_flat_amount).toBe(0.49);
      expect(result.data.fee_category_id).toBe(validCategoryId);
    }
  });

  it("accepts empty fee fields (no fee config)", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Checking",
      account_type: "checking",
      fee_percentage: "",
      fee_flat_amount: "",
      fee_category_id: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fee_percentage).toBeUndefined();
      expect(result.data.fee_flat_amount).toBeUndefined();
      expect(result.data.fee_category_id).toBeUndefined();
    }
  });

  it("accepts fee with only percentage and category", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "PayPal",
      account_type: "paypal",
      fee_percentage: "2.5",
      fee_category_id: validCategoryId,
    });
    expect(result.success).toBe(true);
  });

  it("accepts fee with only flat amount and category", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Stripe",
      account_type: "other",
      fee_flat_amount: "0.30",
      fee_category_id: validCategoryId,
    });
    expect(result.success).toBe(true);
  });

  it("rejects fee percentage without category", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "PayPal",
      account_type: "paypal",
      fee_percentage: "1.99",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("fee_category_id");
    }
  });

  it("rejects fee flat amount without category", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "PayPal",
      account_type: "paypal",
      fee_flat_amount: "0.49",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].path).toContain("fee_category_id");
    }
  });

  it("rejects negative fee percentage", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      account_type: "paypal",
      fee_percentage: "-1",
      fee_category_id: validCategoryId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects fee percentage over 100", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      account_type: "paypal",
      fee_percentage: "101",
      fee_category_id: validCategoryId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative fee flat amount", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      account_type: "paypal",
      fee_flat_amount: "-0.50",
      fee_category_id: validCategoryId,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid fee category UUID", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      account_type: "paypal",
      fee_percentage: "1.99",
      fee_category_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("allows category without fee rate (no refinement error)", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      account_type: "paypal",
      fee_category_id: validCategoryId,
    });
    expect(result.success).toBe(true);
  });

  it("allows zero fee percentage with category (no refinement error)", () => {
    const result = createAccountSchema.safeParse({
      organization_id: validOrgId,
      name: "Test",
      account_type: "paypal",
      fee_percentage: "0",
      fee_category_id: validCategoryId,
    });
    expect(result.success).toBe(true);
  });
});

describe("updateAccountSchema", () => {
  it("requires a valid UUID id", () => {
    const result = updateAccountSchema.safeParse({
      id: "not-a-uuid",
      organization_id: validOrgId,
      name: "Test",
      account_type: "checking",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid update input", () => {
    const result = updateAccountSchema.safeParse({
      id: "660e8400-e29b-41d4-a716-446655440000",
      organization_id: validOrgId,
      name: "Updated Account",
      account_type: "savings",
      opening_balance: "500",
    });
    expect(result.success).toBe(true);
  });

  it("accepts update with fee config", () => {
    const result = updateAccountSchema.safeParse({
      id: "660e8400-e29b-41d4-a716-446655440000",
      organization_id: validOrgId,
      name: "Updated PayPal",
      account_type: "paypal",
      opening_balance: "0",
      fee_percentage: "2.9",
      fee_flat_amount: "0.30",
      fee_category_id: validCategoryId,
    });
    expect(result.success).toBe(true);
  });
});

describe("calculateFee", () => {
  it("calculates percentage-only fee", () => {
    expect(calculateFee(100, 1.99, null)).toBe(1.99);
  });

  it("calculates flat-only fee", () => {
    expect(calculateFee(100, null, 0.49)).toBe(0.49);
  });

  it("calculates combined percentage + flat fee", () => {
    expect(calculateFee(100, 1.99, 0.49)).toBe(2.48);
  });

  it("returns 0 when no fee config", () => {
    expect(calculateFee(100, null, null)).toBe(0);
    expect(calculateFee(100, undefined, undefined)).toBe(0);
    expect(calculateFee(100, 0, 0)).toBe(0);
  });

  it("rounds to 2 decimal places", () => {
    // 33.33 * 1.99% = 0.663267 → should round to 0.66
    expect(calculateFee(33.33, 1.99, 0)).toBe(0.66);
  });

  it("handles large amounts", () => {
    expect(calculateFee(10000, 2.9, 0.30)).toBe(290.30);
  });

  it("handles zero amount", () => {
    expect(calculateFee(0, 1.99, 0.49)).toBe(0.49);
  });
});
