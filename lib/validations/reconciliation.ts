import { z } from "zod";

export const RECONCILIATION_STATUSES = [
  "in_progress",
  "completed",
  "cancelled",
] as const;

export const createReconciliationSchema = z.object({
  account_id: z.string().uuid("Invalid account ID."),
  statement_date: z.string().min(1, "Statement date is required."),
  statement_ending_balance: z.coerce.number({
    message: "Statement ending balance must be a number.",
  }),
});

export const finishReconciliationSchema = z.object({
  session_id: z.string().uuid("Invalid session ID."),
  account_id: z.string().uuid("Invalid account ID."),
  transaction_ids: z.string().min(1, "At least one transaction must be selected."),
});

export const cancelReconciliationSchema = z.object({
  session_id: z.string().uuid("Invalid session ID."),
  account_id: z.string().uuid("Invalid account ID."),
});

export const quickTransactionSchema = z.object({
  account_id: z.string().uuid("Invalid account ID."),
  session_id: z.string().uuid("Invalid session ID."),
  transaction_date: z.string().min(1, "Transaction date is required."),
  description: z
    .string()
    .min(1, "Description is required.")
    .max(255, "Description must be 255 characters or fewer."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  transaction_type: z.enum(["income", "expense"], {
    message: "Invalid transaction type.",
  }),
  category_id: z.string().uuid("Invalid category ID."),
});

export type CreateReconciliationInput = z.infer<typeof createReconciliationSchema>;
export type FinishReconciliationInput = z.infer<typeof finishReconciliationSchema>;
export type CancelReconciliationInput = z.infer<typeof cancelReconciliationSchema>;
export type QuickTransactionInput = z.infer<typeof quickTransactionSchema>;
