import { z } from "zod";

import { RECURRENCE_RULES, RECURRENCE_RULE_LABELS } from "@/lib/recurrence";

import type { RecurrenceRule } from "@/lib/recurrence";

export { RECURRENCE_RULES, RECURRENCE_RULE_LABELS };
export type { RecurrenceRule };

export const templateLineItemSchema = z.object({
  category_id: z.string().uuid("Invalid category ID."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  memo: z
    .string()
    .max(255, "Memo must be 255 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const templateLineItemsArraySchema = z
  .array(templateLineItemSchema)
  .min(1, "At least one line item is required.");

export const createTemplateSchema = z.object({
  account_id: z.string().uuid("Invalid account ID."),
  organization_id: z.string().uuid("Invalid organization ID."),
  transaction_type: z.enum(["income", "expense"], {
    message: "Invalid transaction type.",
  }),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  description: z
    .string()
    .min(1, "Description is required.")
    .max(255, "Description must be 255 characters or fewer."),
  vendor: z
    .string()
    .max(255, "Vendor must be 255 characters or fewer.")
    .optional()
    .or(z.literal("")),
  check_number: z
    .string()
    .max(20, "Check number must be 20 characters or fewer.")
    .optional()
    .or(z.literal("")),
  recurrence_rule: z.enum(RECURRENCE_RULES, {
    message: "Invalid recurrence rule.",
  }),
  start_date: z.string().min(1, "Start date is required."),
  end_date: z.string().optional().or(z.literal("")),
  line_items: z.string().min(1, "Line items are required."),
});

export const updateTemplateSchema = createTemplateSchema.extend({
  id: z.string().uuid("Invalid template ID."),
});

export const generateFromTemplateSchema = z.object({
  template_id: z.string().uuid("Invalid template ID."),
  organization_id: z.string().uuid("Invalid organization ID."),
});

export const createTemplateFromTransactionSchema = z.object({
  transaction_id: z.string().uuid("Invalid transaction ID."),
  organization_id: z.string().uuid("Invalid organization ID."),
  recurrence_rule: z.enum(RECURRENCE_RULES, {
    message: "Invalid recurrence rule.",
  }),
  start_date: z.string().min(1, "Start date is required."),
  end_date: z.string().optional().or(z.literal("")),
});

export type CreateTemplateInput = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateInput = z.infer<typeof updateTemplateSchema>;
export type GenerateFromTemplateInput = z.infer<
  typeof generateFromTemplateSchema
>;
export type CreateTemplateFromTransactionInput = z.infer<
  typeof createTemplateFromTransactionSchema
>;
export type TemplateLineItemInput = z.infer<typeof templateLineItemSchema>;
