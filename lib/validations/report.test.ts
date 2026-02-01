import { describe, it, expect } from "vitest";

import { reportParamsSchema } from "./report";

describe("reportParamsSchema", () => {
  it("accepts valid date range", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing start_date", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "",
      end_date: "2025-12-31",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing end_date", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format - MM/DD/YYYY", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "01/01/2025",
      end_date: "2025-12-31",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid date format - no dashes", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "20250101",
      end_date: "2025-12-31",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional account_id as UUID", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      account_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid account_id format", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      account_id: "not-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional category_id as UUID", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      category_id: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("transforms status string to array", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      status: "cleared,reconciled",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toEqual(["cleared", "reconciled"]);
    }
  });

  it("transforms single status to single-element array", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      status: "uncleared",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toEqual(["uncleared"]);
    }
  });

  it('transforms "all" status to undefined', () => {
    const result = reportParamsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      status: "all",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBeUndefined();
    }
  });

  it("transforms undefined status to undefined", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBeUndefined();
    }
  });

  it("transforms empty string status to undefined", () => {
    const result = reportParamsSchema.safeParse({
      start_date: "2025-01-01",
      end_date: "2025-12-31",
      status: "",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBeUndefined();
    }
  });
});
