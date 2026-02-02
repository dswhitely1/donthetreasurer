import { z } from "zod";

export const ALLOWED_RECEIPT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const ALLOWED_RECEIPT_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export const MAX_RECEIPT_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

export const uploadReceiptSchema = z.object({
  transaction_id: z.string().uuid("Invalid transaction ID."),
  organization_id: z.string().uuid("Invalid organization ID."),
});

export const deleteReceiptSchema = z.object({
  receipt_id: z.string().uuid("Invalid receipt ID."),
  organization_id: z.string().uuid("Invalid organization ID."),
});

export type UploadReceiptInput = z.infer<typeof uploadReceiptSchema>;
export type DeleteReceiptInput = z.infer<typeof deleteReceiptSchema>;
