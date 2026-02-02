import { describe, it, expect } from "vitest";

import {
  createReconciliationSchema,
  finishReconciliationSchema,
  cancelReconciliationSchema,
  quickTransactionSchema,
} from "./reconciliation";

describe("createReconciliationSchema", () => {
  it("accepts valid input", () => {
    const result = createReconciliationSchema.safeParse({
      account_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      statement_date: "2026-01-31",
      statement_ending_balance: "1500.00",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.statement_ending_balance).toBe(1500);
    }
  });

  it("coerces string balance to number", () => {
    const result = createReconciliationSchema.safeParse({
      account_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      statement_date: "2026-01-31",
      statement_ending_balance: "-200.50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.statement_ending_balance).toBe(-200.5);
    }
  });

  it("allows zero balance", () => {
    const result = createReconciliationSchema.safeParse({
      account_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      statement_date: "2026-01-31",
      statement_ending_balance: "0",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID", () => {
    const result = createReconciliationSchema.safeParse({
      account_id: "not-a-uuid",
      statement_date: "2026-01-31",
      statement_ending_balance: "100",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty statement date", () => {
    const result = createReconciliationSchema.safeParse({
      account_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      statement_date: "",
      statement_ending_balance: "100",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-numeric balance", () => {
    const result = createReconciliationSchema.safeParse({
      account_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      statement_date: "2026-01-31",
      statement_ending_balance: "abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("finishReconciliationSchema", () => {
  it("accepts valid input", () => {
    const result = finishReconciliationSchema.safeParse({
      session_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      account_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      transaction_ids: "id1,id2,id3",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty transaction_ids", () => {
    const result = finishReconciliationSchema.safeParse({
      session_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      account_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      transaction_ids: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid session UUID", () => {
    const result = finishReconciliationSchema.safeParse({
      session_id: "bad",
      account_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
      transaction_ids: "id1",
    });
    expect(result.success).toBe(false);
  });
});

describe("cancelReconciliationSchema", () => {
  it("accepts valid input", () => {
    const result = cancelReconciliationSchema.safeParse({
      session_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      account_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid account UUID", () => {
    const result = cancelReconciliationSchema.safeParse({
      session_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
      account_id: "not-valid",
    });
    expect(result.success).toBe(false);
  });
});

describe("quickTransactionSchema", () => {
  const validInput = {
    account_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    session_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12",
    transaction_date: "2026-01-31",
    description: "Bank service fee",
    amount: "5.00",
    transaction_type: "expense",
    category_id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13",
  };

  it("accepts valid input", () => {
    const result = quickTransactionSchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(5);
      expect(result.data.transaction_type).toBe("expense");
    }
  });

  it("coerces string amount to number", () => {
    const result = quickTransactionSchema.safeParse({
      ...validInput,
      amount: "12.50",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe(12.5);
    }
  });

  it("rejects zero amount", () => {
    const result = quickTransactionSchema.safeParse({
      ...validInput,
      amount: "0",
    });
    expect(result.success).toBe(false);
  });

  it("rejects negative amount", () => {
    const result = quickTransactionSchema.safeParse({
      ...validInput,
      amount: "-10",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty description", () => {
    const result = quickTransactionSchema.safeParse({
      ...validInput,
      description: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects description over 255 characters", () => {
    const result = quickTransactionSchema.safeParse({
      ...validInput,
      description: "a".repeat(256),
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid transaction type", () => {
    const result = quickTransactionSchema.safeParse({
      ...validInput,
      transaction_type: "transfer",
    });
    expect(result.success).toBe(false);
  });

  it("accepts income type", () => {
    const result = quickTransactionSchema.safeParse({
      ...validInput,
      transaction_type: "income",
    });
    expect(result.success).toBe(true);
  });
});
