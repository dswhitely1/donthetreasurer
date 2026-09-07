import { z } from "zod";

import { TRANSACTION_STATUSES } from "./transaction";

export const SPONSOR_PAYMENT_METHODS = [
  "cash",
  "check",
  "paypal",
  "other",
] as const;

export type SponsorPaymentMethod = (typeof SPONSOR_PAYMENT_METHODS)[number];

export const SPONSOR_PAYMENT_METHOD_LABELS: Record<
  SponsorPaymentMethod,
  string
> = {
  cash: "Cash",
  check: "Check",
  paypal: "PayPal",
  other: "Other",
};

/** PayPal money arrives electronically and never rides along in a bank deposit. */
export const ELECTRONIC_PAYMENT_METHODS: readonly SponsorPaymentMethod[] = [
  "paypal",
];

/**
 * Shared verbatim between the deposit action's server-side check and the
 * deposit builder's client-side guard, so the two can never drift apart.
 */
export const MIXED_PAYMENT_METHODS_ERROR =
  "PayPal payments cannot be deposited together with cash or check payments. Deposit them separately.";

const optionalText = (max: number, label: string) =>
  z
    .string()
    .max(max, `${label} must be ${max} characters or fewer.`)
    .optional()
    .or(z.literal(""));

export const createSponsorSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Sponsor name is required.")
    .max(150, "Sponsor name must be 150 characters or fewer."),
  contact_name: optionalText(100, "Contact name"),
  email: z
    .string()
    .email("Email must be a valid email address.")
    .max(255, "Email must be 255 characters or fewer.")
    .optional()
    .or(z.literal("")),
  phone: optionalText(30, "Phone"),
  address_line1: optionalText(150, "Address"),
  address_line2: optionalText(150, "Address line 2"),
  city: optionalText(100, "City"),
  state: optionalText(50, "State"),
  postal_code: optionalText(20, "Postal code"),
  notes: optionalText(1000, "Notes"),
  is_active: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
});

export const updateSponsorSchema = createSponsorSchema.extend({
  id: z.string().uuid("Invalid sponsor ID."),
});

export const createSponsorLevelSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Level name is required.")
    .max(100, "Level name must be 100 characters or fewer."),
  default_amount: z.coerce
    .number()
    .nonnegative("Default amount cannot be negative."),
  description: optionalText(500, "Description"),
  sort_order: z.coerce.number().int().default(0),
  is_active: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
});

export const updateSponsorLevelSchema = createSponsorLevelSchema.extend({
  id: z.string().uuid("Invalid level ID."),
});

const sponsorshipBaseSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  sponsor_id: z.string().uuid("Invalid sponsor ID."),
  level_id: z.string().uuid("Invalid sponsorship level ID."),
  term_start_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Term start must be a valid date."),
  term_end_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Term end must be a valid date."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  payment_method: z.enum(SPONSOR_PAYMENT_METHODS, {
    message: "Invalid payment method.",
  }),
  check_number: optionalText(20, "Check number"),
  received_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Received date must be a valid date."),
  notes: optionalText(1000, "Notes"),
});

/**
 * A check number on a cash payment is a data-entry slip, not a harmless extra:
 * it would print on the acknowledgment letter.
 */
function checkSponsorshipConsistency(
  data: z.infer<typeof sponsorshipBaseSchema>,
  ctx: z.RefinementCtx
): void {
  if (data.term_end_date <= data.term_start_date) {
    ctx.addIssue({
      code: "custom",
      path: ["term_end_date"],
      message: "Term end date must be after the term start date.",
    });
  }

  if (data.check_number && data.payment_method !== "check") {
    ctx.addIssue({
      code: "custom",
      path: ["check_number"],
      message: "A check number can only be recorded on a check payment.",
    });
  }
}

export const createSponsorshipSchema = sponsorshipBaseSchema.superRefine(
  checkSponsorshipConsistency
);

export const updateSponsorshipSchema = sponsorshipBaseSchema
  .extend({ id: z.string().uuid("Invalid sponsorship ID.") })
  .superRefine(checkSponsorshipConsistency);

/**
 * Deposit lines carry no amount. Amounts are re-read from the sponsorship rows
 * inside the action, so a tampered form cannot post a deposit whose lines
 * disagree with the records they claim to represent.
 */
export const depositLineSchema = z.object({
  sponsorship_id: z.string().uuid("Invalid sponsorship ID."),
  category_id: z.string().uuid("Invalid category ID."),
  memo: optionalText(255, "Memo"),
});

export const depositLinesArraySchema = z
  .array(depositLineSchema)
  .min(1, "Select at least one queued payment.")
  .superRefine((lines, ctx) => {
    const ids = new Set<string>();
    for (const line of lines) {
      if (ids.has(line.sponsorship_id)) {
        ctx.addIssue({
          code: "custom",
          message: "Each queued payment can only be deposited once.",
        });
        return;
      }
      ids.add(line.sponsorship_id);
    }
  });

export const depositFromQueueSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  account_id: z.string().uuid("Invalid account ID."),
  transaction_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Deposit date must be a valid date."),
  description: z
    .string()
    .min(1, "Description is required.")
    .max(255, "Description must be 255 characters or fewer."),
  status: z
    .enum(TRANSACTION_STATUSES, { message: "Invalid status." })
    .default("uncleared"),
  cleared_at: z.string().optional().or(z.literal("")),
  apply_fee: z.string().optional(),
  lines: z.string().min(1, "Deposit lines are required."),
});

export const sponsorLetterRequestSchema = z.object({
  template_id: z.string().uuid(),
  sponsorship_ids: z.array(z.string().uuid()).min(1),
});

export type CreateSponsorInput = z.infer<typeof createSponsorSchema>;
export type CreateSponsorLevelInput = z.infer<typeof createSponsorLevelSchema>;
export type CreateSponsorshipInput = z.infer<typeof createSponsorshipSchema>;
export type DepositLineInput = z.infer<typeof depositLineSchema>;
export type DepositFromQueueInput = z.infer<typeof depositFromQueueSchema>;
