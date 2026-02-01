import { describe, it, expect } from "vitest";

import {
  createOrganizationSchema,
  updateOrganizationSchema,
} from "./organization";

describe("createOrganizationSchema", () => {
  it("accepts valid input with all fields", () => {
    const result = createOrganizationSchema.safeParse({
      name: "Community Foundation",
      ein: "12-3456789",
      fiscal_year_start_month: "7",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe("Community Foundation");
      expect(result.data.ein).toBe("12-3456789");
      expect(result.data.fiscal_year_start_month).toBe(7);
    }
  });

  it("accepts valid input with minimal fields", () => {
    const result = createOrganizationSchema.safeParse({
      name: "My Org",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fiscal_year_start_month).toBe(1);
    }
  });

  it("accepts empty string for ein", () => {
    const result = createOrganizationSchema.safeParse({
      name: "My Org",
      ein: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", () => {
    const result = createOrganizationSchema.safeParse({
      name: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects name longer than 100 characters", () => {
    const result = createOrganizationSchema.safeParse({
      name: "A".repeat(101),
    });
    expect(result.success).toBe(false);
  });

  it("accepts name of exactly 100 characters", () => {
    const result = createOrganizationSchema.safeParse({
      name: "A".repeat(100),
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid EIN format - missing dash", () => {
    const result = createOrganizationSchema.safeParse({
      name: "My Org",
      ein: "123456789",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid EIN format - wrong digit count", () => {
    const result = createOrganizationSchema.safeParse({
      name: "My Org",
      ein: "12-345678",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid EIN format - letters", () => {
    const result = createOrganizationSchema.safeParse({
      name: "My Org",
      ein: "AB-CDEFGHI",
    });
    expect(result.success).toBe(false);
  });

  it("coerces fiscal_year_start_month from string", () => {
    const result = createOrganizationSchema.safeParse({
      name: "My Org",
      fiscal_year_start_month: "12",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fiscal_year_start_month).toBe(12);
    }
  });

  it("rejects fiscal_year_start_month below 1", () => {
    const result = createOrganizationSchema.safeParse({
      name: "My Org",
      fiscal_year_start_month: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects fiscal_year_start_month above 12", () => {
    const result = createOrganizationSchema.safeParse({
      name: "My Org",
      fiscal_year_start_month: "13",
    });
    expect(result.success).toBe(false);
  });

  it("defaults fiscal_year_start_month to 1", () => {
    const result = createOrganizationSchema.safeParse({
      name: "My Org",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.fiscal_year_start_month).toBe(1);
    }
  });
});

describe("updateOrganizationSchema", () => {
  it("requires a valid UUID id", () => {
    const result = updateOrganizationSchema.safeParse({
      id: "not-a-uuid",
      name: "My Org",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid update input", () => {
    const result = updateOrganizationSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      name: "Updated Org",
      ein: "98-7654321",
      fiscal_year_start_month: "6",
    });
    expect(result.success).toBe(true);
  });
});
