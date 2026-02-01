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

const optionalNumber = (constraints: { min?: number; max?: number; minMsg?: string; maxMsg?: string }) => {
  let schema = z.coerce.number();
  if (constraints.min !== undefined)
    schema = schema.min(constraints.min, constraints.minMsg);
  if (constraints.max !== undefined)
    schema = schema.max(constraints.max, constraints.maxMsg);
  return z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    schema.optional()
  );
};

const feeFieldsSchema = z.object({
  fee_percentage: optionalNumber({
    min: 0,
    max: 100,
    minMsg: "Fee percentage cannot be negative.",
    maxMsg: "Fee percentage cannot exceed 100.",
  }),
  fee_flat_amount: optionalNumber({
    min: 0,
    minMsg: "Fee flat amount cannot be negative.",
  }),
  fee_category_id: z.preprocess(
    (val) => (val === "" || val === null || val === undefined ? undefined : val),
    z.string().uuid("Invalid fee category ID.").optional()
  ),
});

export const createAccountSchema = z
  .object({
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
  })
  .merge(feeFieldsSchema)
  .refine(
    (data) => {
      const hasFeeRate =
        (data.fee_percentage !== undefined && data.fee_percentage > 0) ||
        (data.fee_flat_amount !== undefined && data.fee_flat_amount > 0);
      if (hasFeeRate && !data.fee_category_id) {
        return false;
      }
      return true;
    },
    {
      message: "Fee category is required when a fee percentage or flat amount is set.",
      path: ["fee_category_id"],
    }
  );

export const updateAccountSchema = createAccountSchema.extend({
  id: z.string().uuid("Invalid account ID."),
});

export function calculateFee(
  amount: number,
  feePercentage: number | null | undefined,
  feeFlatAmount: number | null | undefined
): number {
  let fee = 0;
  if (feePercentage && feePercentage > 0) {
    fee += amount * (feePercentage / 100);
  }
  if (feeFlatAmount && feeFlatAmount > 0) {
    fee += feeFlatAmount;
  }
  return Math.round(fee * 100) / 100;
}

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
