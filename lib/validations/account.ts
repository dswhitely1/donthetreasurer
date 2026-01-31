import { z } from "zod";

export const ACCOUNT_TYPES = [
  "checking",
  "savings",
  "paypal",
  "cash",
  "other",
] as const;

export const ACCOUNT_TYPE_LABELS: Record<(typeof ACCOUNT_TYPES)[number], string> = {
  checking: "Checking",
  savings: "Savings",
  paypal: "PayPal",
  cash: "Cash",
  other: "Other",
};

export const createAccountSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Account name is required.")
    .max(100, "Account name must be 100 characters or fewer."),
  account_type: z.enum(ACCOUNT_TYPES, {
    message: "Invalid account type.",
  }),
  description: z
    .string()
    .max(500, "Description must be 500 characters or fewer.")
    .optional()
    .or(z.literal("")),
  opening_balance: z.coerce
    .number()
    .min(0, "Opening balance cannot be negative.")
    .default(0),
});

export const updateAccountSchema = createAccountSchema.extend({
  id: z.string().uuid("Invalid account ID."),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
