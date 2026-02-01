import { describe, it, expect } from "vitest";

import {
  lineItemSchema,
  lineItemsArraySchema,
  createTransactionSchema,
  updateTransactionSchema,
  inlineUpdateTransactionSchema,
  TRANSACTION_TYPES,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_STATUSES,
  TRANSACTION_STATUS_LABELS,
  INLINE_EDITABLE_FIELDS,
} from "./transaction";

const validUuid = "550e8400-e29b-41d4-a716-446655440000";

describe("constants", () => {
  it("has income and expense types", () => {
    expect(TRANSACTION_TYPES).toEqual(["income", "expense"]);
  });

  it("has labels for every type", () => {
    for (const type of TRANSACTION_TYPES) {
      expect(TRANSACTION_TYPE_LABELS[type]).toBeDefined();
    }
  });

  it("has three statuses", () => {
    expect(TRANSACTION_STATUSES).toEqual([
      "uncleared",
      "cleared",
      "reconciled",
    ]);
  });

  it("has labels for every status", () => {
    for (const status of TRANSACTION_STATUSES) {
      expect(TRANSACTION_STATUS_LABELS[status]).toBeDefined();
    }
  });

  it("has all inline editable fields", () => {
    expect(INLINE_EDITABLE_FIELDS).toContain("transaction_date");
    expect(INLINE_EDITABLE_FIELDS).toContain("description");
    expect(INLINE_EDITABLE_FIELDS).toContain("check_number");
    expect(INLINE_EDITABLE_FIELDS).toContain("vendor");
    expect(INLINE_EDITABLE_FIELDS).toContain("status");
    expect(INLINE_EDITABLE_FIELDS).toContain("amount");
    expect(INLINE_EDITABLE_FIELDS).toContain("account_id");
    expect(INLINE_EDITABLE_FIELDS).toContain("cleared_at");
  });
});

describe("lineItemSchema", () => {
  it("accepts valid line item", () => {
    const result = lineItemSchema.safeParse({
      category_id: validUuid,
      amount: 100,
      memo: "Test memo",
    });
    expect(result.success).toBe(true);
  });

  it("coerces amount from string", () => {
    const result = lineItemSchema.safeParse({
      category_id: validUuid,
      amount: "250.50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(250.5);
    }
  });

  it("rejects zero amount", () => {
    const result = lineItemSchema.safeParse({
      category_id: validUuid,
      amount: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = lineItemSchema.safeParse({
      category_id: validUuid,
      amount: -10,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid category_id", () => {
    const result = lineItemSchema.safeParse({
      category_id: "not-uuid",
      amount: 100,
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty string for memo", () => {
    const result = lineItemSchema.safeParse({
      category_id: validUuid,
      amount: 100,
      memo: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects memo longer than 255 characters", () => {
    const result = lineItemSchema.safeParse({
      category_id: validUuid,
      amount: 100,
      memo: "A".repeat(256),
    });
    expect(result.success).toBe(false);
  });
});

describe("lineItemsArraySchema", () => {
  it("accepts array with one line item", () => {
    const result = lineItemsArraySchema.safeParse([
      { category_id: validUuid, amount: 100 },
    ]);
    expect(result.success).toBe(true);
  });

  it("accepts array with multiple line items", () => {
    const result = lineItemsArraySchema.safeParse([
      { category_id: validUuid, amount: 350 },
      { category_id: validUuid, amount: 150 },
    ]);
    expect(result.success).toBe(true);
  });

  it("rejects empty array", () => {
    const result = lineItemsArraySchema.safeParse([]);
    expect(result.success).toBe(false);
  });
});

describe("createTransactionSchema", () => {
  const validInput = {
    account_id: validUuid,
    transaction_date: "2025-01-15",
    amount: "500",
    transaction_type: "expense",
    description: "Office Supplies",
    line_items: '[{"category_id":"550e8400-e29b-41d4-a716-446655440000","amount":500}]',
  };

  it("accepts valid input", () => {
    const result = createTransactionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(500);
    }
  });

  it("coerces amount from string", () => {
    const result = createTransactionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.amount).toBe("number");
    }
  });

  it("defaults status to uncleared", () => {
    const result = createTransactionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe("uncleared");
    }
  });

  it("rejects missing description", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description longer than 255 characters", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      description: "A".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects zero amount", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      amount: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing transaction_date", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      transaction_date: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid transaction_type", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      transaction_type: "transfer",
    });
    expect(result.success).toBe(false);
  });

  it("accepts all valid statuses", () => {
    for (const status of TRANSACTION_STATUSES) {
      const result = createTransactionSchema.safeParse({
        ...validInput,
        status,
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects check_number longer than 20 characters", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      check_number: "A".repeat(21),
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty string for check_number", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      check_number: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts valid vendor", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      vendor: "Staples",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for vendor", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      vendor: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects vendor longer than 255 characters", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      vendor: "A".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional cleared_at date", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      cleared_at: "2025-01-20",
      status: "cleared",
    });
    expect(result.success).toBe(true);
  });

  it("accepts empty string for cleared_at", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      cleared_at: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts missing cleared_at", () => {
    const result = createTransactionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("line_items is treated as a string (JSON)", () => {
    const result = createTransactionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(typeof result.data.line_items).toBe("string");
    }
  });

  it("rejects empty line_items string", () => {
    const result = createTransactionSchema.safeParse({
      ...validInput,
      line_items: "",
    });
    expect(result.success).toBe(false);
  });
});

describe("updateTransactionSchema", () => {
  it("requires a valid UUID id", () => {
    const result = updateTransactionSchema.safeParse({
      id: "not-uuid",
      account_id: validUuid,
      transaction_date: "2025-01-15",
      amount: "500",
      transaction_type: "expense",
      description: "Test",
      line_items: "[]",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid update input", () => {
    const result = updateTransactionSchema.safeParse({
      id: validUuid,
      account_id: validUuid,
      transaction_date: "2025-01-15",
      amount: "500",
      transaction_type: "expense",
      description: "Test",
      line_items: '[{"category_id":"550e8400-e29b-41d4-a716-446655440000","amount":500}]',
    });
    expect(result.success).toBe(true);
  });
});

describe("inlineUpdateTransactionSchema", () => {
  it("accepts valid inline update", () => {
    const result = inlineUpdateTransactionSchema.safeParse({
      id: validUuid,
      org_id: validUuid,
      field: "description",
      value: "Updated description",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all editable fields", () => {
    for (const field of INLINE_EDITABLE_FIELDS) {
      const result = inlineUpdateTransactionSchema.safeParse({
        id: validUuid,
        org_id: validUuid,
        field,
        value: "test",
      });
      expect(result.success).toBe(true);
    }
  });

  it("rejects non-editable field", () => {
    const result = inlineUpdateTransactionSchema.safeParse({
      id: validUuid,
      org_id: validUuid,
      field: "created_at",
      value: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid transaction id", () => {
    const result = inlineUpdateTransactionSchema.safeParse({
      id: "not-uuid",
      org_id: validUuid,
      field: "description",
      value: "test",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid org id", () => {
    const result = inlineUpdateTransactionSchema.safeParse({
      id: validUuid,
      org_id: "not-uuid",
      field: "description",
      value: "test",
    });
    expect(result.success).toBe(false);
  });
});
