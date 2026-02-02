import { describe, it, expect } from "vitest";

import {
  createTemplateSchema,
  updateTemplateSchema,
  generateFromTemplateSchema,
  templateLineItemSchema,
  templateLineItemsArraySchema,
} from "./recurring-template";

describe("templateLineItemSchema", () => {
  it("validates a valid line item", () => {
    const result = templateLineItemSchema.safeParse({
      category_id: "550e8400-e29b-41d4-a716-446655440000",
      amount: "100.50",
      memo: "Test memo",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid category_id", () => {
    const result = templateLineItemSchema.safeParse({
      category_id: "not-a-uuid",
      amount: "100",
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = templateLineItemSchema.safeParse({
      category_id: "550e8400-e29b-41d4-a716-446655440000",
      amount: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = templateLineItemSchema.safeParse({
      category_id: "550e8400-e29b-41d4-a716-446655440000",
      amount: "-10",
    });
    expect(result.success).toBe(false);
  });

  it("allows empty memo", () => {
    const result = templateLineItemSchema.safeParse({
      category_id: "550e8400-e29b-41d4-a716-446655440000",
      amount: "50",
      memo: "",
    });
    expect(result.success).toBe(true);
  });
});

describe("templateLineItemsArraySchema", () => {
  it("requires at least one item", () => {
    const result = templateLineItemsArraySchema.safeParse([]);
    expect(result.success).toBe(false);
  });

  it("accepts a valid array", () => {
    const result = templateLineItemsArraySchema.safeParse([
      {
        category_id: "550e8400-e29b-41d4-a716-446655440000",
        amount: 100,
      },
    ]);
    expect(result.success).toBe(true);
  });
});

describe("createTemplateSchema", () => {
  const validData = {
    account_id: "550e8400-e29b-41d4-a716-446655440000",
    organization_id: "660e8400-e29b-41d4-a716-446655440000",
    transaction_type: "expense",
    amount: "150.00",
    description: "Monthly rent",
    vendor: "Landlord Inc",
    check_number: "",
    recurrence_rule: "monthly",
    start_date: "2026-02-01",
    end_date: "",
    line_items: JSON.stringify([
      {
        category_id: "550e8400-e29b-41d4-a716-446655440000",
        amount: 150,
      },
    ]),
  };

  it("validates valid create data", () => {
    const result = createTemplateSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  it("rejects missing description", () => {
    const result = createTemplateSchema.safeParse({
      ...validData,
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid recurrence rule", () => {
    const result = createTemplateSchema.safeParse({
      ...validData,
      recurrence_rule: "daily",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing start date", () => {
    const result = createTemplateSchema.safeParse({
      ...validData,
      start_date: "",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid recurrence rules", () => {
    const rules = ["weekly", "bi-weekly", "monthly", "quarterly", "annually"];
    for (const rule of rules) {
      const result = createTemplateSchema.safeParse({
        ...validData,
        recurrence_rule: rule,
      });
      expect(result.success).toBe(true);
    }
  });

  it("coerces amount from string", () => {
    const result = createTemplateSchema.safeParse(validData);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(150);
    }
  });
});

describe("updateTemplateSchema", () => {
  it("requires id field", () => {
    const result = updateTemplateSchema.safeParse({
      account_id: "550e8400-e29b-41d4-a716-446655440000",
      organization_id: "660e8400-e29b-41d4-a716-446655440000",
      transaction_type: "expense",
      amount: "150.00",
      description: "Monthly rent",
      recurrence_rule: "monthly",
      start_date: "2026-02-01",
      line_items: "[]",
    });
    expect(result.success).toBe(false);
  });

  it("validates with id field", () => {
    const result = updateTemplateSchema.safeParse({
      id: "770e8400-e29b-41d4-a716-446655440000",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
      organization_id: "660e8400-e29b-41d4-a716-446655440000",
      transaction_type: "expense",
      amount: "150.00",
      description: "Monthly rent",
      recurrence_rule: "monthly",
      start_date: "2026-02-01",
      line_items: '[{"category_id":"550e8400-e29b-41d4-a716-446655440000","amount":150}]',
    });
    expect(result.success).toBe(true);
  });
});

describe("generateFromTemplateSchema", () => {
  it("validates valid generate data", () => {
    const result = generateFromTemplateSchema.safeParse({
      template_id: "550e8400-e29b-41d4-a716-446655440000",
      organization_id: "660e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid template_id", () => {
    const result = generateFromTemplateSchema.safeParse({
      template_id: "not-uuid",
      organization_id: "660e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(false);
  });
});
