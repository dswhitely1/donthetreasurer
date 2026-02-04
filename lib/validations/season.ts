import { z } from "zod";

export const SEASON_STATUSES = ["active", "archived"] as const;

export const SEASON_STATUS_LABELS: Record<
  (typeof SEASON_STATUSES)[number],
  string
> = {
  active: "Active",
  archived: "Archived",
};

export type SeasonStatus = (typeof SEASON_STATUSES)[number];

export const ENROLLMENT_STATUSES = ["enrolled", "withdrawn"] as const;

export const ENROLLMENT_STATUS_LABELS: Record<
  (typeof ENROLLMENT_STATUSES)[number],
  string
> = {
  enrolled: "Enrolled",
  withdrawn: "Withdrawn",
};

export type EnrollmentStatus = (typeof ENROLLMENT_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "partial", "paid", "overpaid"] as const;

export const PAYMENT_STATUS_LABELS: Record<
  (typeof PAYMENT_STATUSES)[number],
  string
> = {
  unpaid: "Unpaid",
  partial: "Partial",
  paid: "Paid",
  overpaid: "Overpaid",
};

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

const dateRangeRefinement = (data: { start_date: string; end_date: string }) =>
  data.start_date < data.end_date;

const dateRangeOptions = {
  message: "Start date must be before end date.",
  path: ["end_date"] as string[],
};

const baseSeasonSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Name is required.")
    .max(150, "Name must be 150 characters or fewer."),
  description: z
    .string()
    .max(2000, "Description must be 2000 characters or fewer.")
    .optional()
    .or(z.literal("")),
  start_date: z.string().min(1, "Start date is required."),
  end_date: z.string().min(1, "End date is required."),
  fee_amount: z.coerce
    .number()
    .min(0, "Fee amount must be zero or greater.")
    .multipleOf(0.01, "Fee amount must have at most 2 decimal places."),
  status: z.enum(SEASON_STATUSES, {
    message: "Invalid season status.",
  }),
});

export const createSeasonSchema = baseSeasonSchema.refine(
  dateRangeRefinement,
  dateRangeOptions
);

export const updateSeasonSchema = baseSeasonSchema
  .extend({
    id: z.string().uuid("Invalid season ID."),
  })
  .refine(dateRangeRefinement, dateRangeOptions);

export const enrollmentSchema = z.object({
  student_id: z.string().uuid("Invalid student ID."),
  fee_amount: z.coerce
    .number()
    .min(0, "Fee amount must be zero or greater.")
    .multipleOf(0.01, "Fee amount must have at most 2 decimal places."),
  fee_override_reason: z
    .string()
    .max(255, "Fee override reason must be 255 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const enrollStudentsSchema = z
  .object({
    season_id: z.string().uuid("Invalid season ID."),
    enrollments: z.array(enrollmentSchema).min(1, "At least one student is required."),
  })
  .refine(
    (data) => {
      const studentIds = data.enrollments.map((e) => e.student_id);
      return new Set(studentIds).size === studentIds.length;
    },
    { message: "Duplicate students are not allowed.", path: ["enrollments"] }
  );

export const paymentSchema = z.object({
  enrollment_id: z.string().uuid("Invalid enrollment ID."),
  payment_date: z.string().min(1, "Payment date is required."),
  amount: z.coerce
    .number()
    .positive("Amount must be greater than zero.")
    .multipleOf(0.01, "Amount must have at most 2 decimal places."),
  payment_method: z
    .string()
    .max(100, "Payment method must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(500, "Notes must be 500 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const updatePaymentSchema = paymentSchema.extend({
  id: z.string().uuid("Invalid payment ID."),
});

export type CreateSeasonInput = z.infer<typeof createSeasonSchema>;
export type UpdateSeasonInput = z.infer<typeof updateSeasonSchema>;
export type EnrollmentInput = z.infer<typeof enrollmentSchema>;
export type EnrollStudentsInput = z.infer<typeof enrollStudentsSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
