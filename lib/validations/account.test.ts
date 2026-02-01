import { describe, it, expect } from "vitest";

import {
  createAccountSchema,
  updateAccountSchema,
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_LABELS,
} from "./account";

const validOrgId = "550e8400-e29b-41d4-a716-446655440000";

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
});
