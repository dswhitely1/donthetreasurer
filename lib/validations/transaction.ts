import { z } from "zod";

export const TRANSACTION_TYPES = ["income", "expense"] as const;

export const TRANSACTION_TYPE_LABELS: Record<
  (typeof TRANSACTION_TYPES)[number],
  string
> = {
  income: "Income",
  expense: "Expense",
};

export const TRANSACTION_STATUSES = [
  "uncleared",
  "cleared",
  "reconciled",
] as const;

export const TRANSACTION_STATUS_LABELS: Record<
  (typeof TRANSACTION_STATUSES)[number],
  string
> = {
  uncleared: "Uncleared",
  cleared: "Cleared",
  reconciled: "Reconciled",
};

export const lineItemSchema = z.object({
  category_id: z.string().uuid("Invalid category ID."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  memo: z
    .string()
    .max(255, "Memo must be 255 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const lineItemsArraySchema = z
  .array(lineItemSchema)
  .min(1, "At least one line item is required.");

export const createTransactionSchema = z.object({
  account_id: z.string().uuid("Invalid account ID."),
  transaction_date: z.string().min(1, "Transaction date is required."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  transaction_type: z.enum(TRANSACTION_TYPES, {
    message: "Invalid transaction type.",
  }),
  description: z
    .string()
    .min(1, "Description is required.")
    .max(255, "Description must be 255 characters or fewer."),
  check_number: z
    .string()
    .max(20, "Check number must be 20 characters or fewer.")
    .optional()
    .or(z.literal("")),
  status: z
    .enum(TRANSACTION_STATUSES, { message: "Invalid status." })
    .default("uncleared"),
  line_items: z.string().min(1, "Line items are required."),
});

export const updateTransactionSchema = createTransactionSchema.extend({
  id: z.string().uuid("Invalid transaction ID."),
});

export const INLINE_EDITABLE_FIELDS = [
  "transaction_date",
  "description",
  "check_number",
  "status",
  "amount",
  "account_id",
] as const;

export const inlineUpdateTransactionSchema = z.object({
  id: z.string().uuid("Invalid transaction ID."),
  org_id: z.string().uuid("Invalid organization ID."),
  field: z.enum(INLINE_EDITABLE_FIELDS, {
    message: "Invalid editable field.",
  }),
  value: z.string(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;
export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;
export type LineItemInput = z.infer<typeof lineItemSchema>;
export type InlineUpdateTransactionInput = z.infer<
  typeof inlineUpdateTransactionSchema
>;
