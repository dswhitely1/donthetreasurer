import { describe, it, expect } from "vitest";

import {
  createSponsorLevelSchema,
  createSponsorSchema,
  createSponsorshipSchema,
  depositLinesArraySchema,
} from "./sponsor";

const orgId = "660e8400-e29b-41d4-a716-446655440000";
const sponsorId = "770e8400-e29b-41d4-a716-446655440000";
const levelId = "880e8400-e29b-41d4-a716-446655440000";
const categoryId = "990e8400-e29b-41d4-a716-446655440000";
const sponsorshipId = "aa0e8400-e29b-41d4-a716-446655440000";

function validSponsorship(overrides: Record<string, unknown> = {}) {
  return {
    organization_id: orgId,
    sponsor_id: sponsorId,
    level_id: levelId,
    term_start_date: "2026-07-01",
    term_end_date: "2027-06-30",
    amount: "500",
    payment_method: "check",
    check_number: "1043",
    received_date: "2026-08-14",
    notes: "",
    ...overrides,
  };
}

describe("createSponsorSchema", () => {
  it("accepts a sponsor with only a name", () => {
    const result = createSponsorSchema.safeParse({
      organization_id: orgId,
      name: "Acme Hardware",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an empty name", () => {
    const result = createSponsorSchema.safeParse({
      organization_id: orgId,
      name: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("createSponsorLevelSchema", () => {
  it("coerces the default amount from a form string", () => {
    const result = createSponsorLevelSchema.safeParse({
      organization_id: orgId,
      name: "Gold",
      default_amount: "500",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.default_amount).toBe(500);
  });

  it("rejects a negative default amount", () => {
    const result = createSponsorLevelSchema.safeParse({
      organization_id: orgId,
      name: "Gold",
      default_amount: "-1",
    });
    expect(result.success).toBe(false);
  });
});

describe("createSponsorshipSchema", () => {
  it("accepts a valid check sponsorship", () => {
    const result = createSponsorshipSchema.safeParse(validSponsorship());
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.amount).toBe(500);
  });

  it("rejects a term that ends before it starts", () => {
    const result = createSponsorshipSchema.safeParse(
      validSponsorship({ term_start_date: "2027-07-01", term_end_date: "2026-06-30" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/end date/i);
    }
  });

  it("rejects a zero amount", () => {
    const result = createSponsorshipSchema.safeParse(
      validSponsorship({ amount: "0" })
    );
    expect(result.success).toBe(false);
  });

  it("rejects a check number on a cash payment", () => {
    const result = createSponsorshipSchema.safeParse(
      validSponsorship({ payment_method: "cash", check_number: "1043" })
    );
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/check number/i);
    }
  });

  it("accepts a check payment with no check number recorded", () => {
    const result = createSponsorshipSchema.safeParse(
      validSponsorship({ check_number: "" })
    );
    expect(result.success).toBe(true);
  });
});

describe("depositLinesArraySchema", () => {
  it("requires at least one line", () => {
    expect(depositLinesArraySchema.safeParse([]).success).toBe(false);
  });

  it("rejects the same sponsorship twice", () => {
    const line = { sponsorship_id: sponsorshipId, category_id: categoryId, memo: "Acme" };
    const result = depositLinesArraySchema.safeParse([line, line]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toMatch(/once/i);
    }
  });

  it("carries no amount field, so amounts cannot be client-supplied", () => {
    const result = depositLinesArraySchema.safeParse([
      { sponsorship_id: sponsorshipId, category_id: categoryId, memo: "Acme", amount: 999999 },
    ]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect("amount" in result.data[0]).toBe(false);
    }
  });
});
