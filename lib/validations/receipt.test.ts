import { describe, it, expect } from "vitest";

import {
  uploadReceiptSchema,
  deleteReceiptSchema,
  ALLOWED_RECEIPT_MIME_TYPES,
  ALLOWED_RECEIPT_EXTENSIONS,
  MAX_RECEIPT_FILE_SIZE,
} from "./receipt";

describe("receipt constants", () => {
  it("allows exactly 4 MIME types", () => {
    expect(ALLOWED_RECEIPT_MIME_TYPES).toHaveLength(4);
    expect(ALLOWED_RECEIPT_MIME_TYPES).toContain("image/jpeg");
    expect(ALLOWED_RECEIPT_MIME_TYPES).toContain("image/png");
    expect(ALLOWED_RECEIPT_MIME_TYPES).toContain("image/webp");
    expect(ALLOWED_RECEIPT_MIME_TYPES).toContain("application/pdf");
  });

  it("maps each MIME type to an extension", () => {
    for (const mime of ALLOWED_RECEIPT_MIME_TYPES) {
      expect(ALLOWED_RECEIPT_EXTENSIONS[mime]).toBeDefined();
    }
    expect(ALLOWED_RECEIPT_EXTENSIONS["image/jpeg"]).toBe("jpg");
    expect(ALLOWED_RECEIPT_EXTENSIONS["image/png"]).toBe("png");
    expect(ALLOWED_RECEIPT_EXTENSIONS["image/webp"]).toBe("webp");
    expect(ALLOWED_RECEIPT_EXTENSIONS["application/pdf"]).toBe("pdf");
  });

  it("sets max file size to 5 MB", () => {
    expect(MAX_RECEIPT_FILE_SIZE).toBe(5 * 1024 * 1024);
  });
});

describe("uploadReceiptSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid UUIDs", () => {
    const result = uploadReceiptSchema.safeParse({
      transaction_id: validUuid,
      organization_id: validUuid,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid transaction_id", () => {
    const result = uploadReceiptSchema.safeParse({
      transaction_id: "not-a-uuid",
      organization_id: validUuid,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid organization_id", () => {
    const result = uploadReceiptSchema.safeParse({
      transaction_id: validUuid,
      organization_id: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = uploadReceiptSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("deleteReceiptSchema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("accepts valid UUIDs", () => {
    const result = deleteReceiptSchema.safeParse({
      receipt_id: validUuid,
      organization_id: validUuid,
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid receipt_id", () => {
    const result = deleteReceiptSchema.safeParse({
      receipt_id: "not-a-uuid",
      organization_id: validUuid,
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid organization_id", () => {
    const result = deleteReceiptSchema.safeParse({
      receipt_id: validUuid,
      organization_id: "bad",
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing fields", () => {
    const result = deleteReceiptSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
