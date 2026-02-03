import { z } from "zod";

export const BUDGET_STATUSES = ["draft", "active", "closed"] as const;

export const BUDGET_STATUS_LABELS: Record<(typeof BUDGET_STATUSES)[number], string> = {
  draft: "Draft",
  active: "Active",
  closed: "Closed",
};

export type BudgetStatus = (typeof BUDGET_STATUSES)[number];

export const budgetLineItemSchema = z.object({
  category_id: z.string().uuid("Invalid category ID."),
  amount: z.coerce.number().positive("Amount must be greater than zero."),
  notes: z
    .string()
    .max(500, "Notes must be 500 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const budgetLineItemsArraySchema = z
  .array(budgetLineItemSchema)
  .min(1, "At least one line item is required.");

export const createBudgetSchema = z
  .object({
    organization_id: z.string().uuid("Invalid organization ID."),
    name: z
      .string()
      .min(1, "Name is required.")
      .max(150, "Name must be 150 characters or fewer."),
    start_date: z.string().min(1, "Start date is required."),
    end_date: z.string().min(1, "End date is required."),
    status: z.enum(BUDGET_STATUSES, {
      message: "Invalid budget status.",
    }),
    notes: z
      .string()
      .max(1000, "Notes must be 1000 characters or fewer.")
      .optional()
      .or(z.literal("")),
    line_items: z.string().min(1, "Line items are required."),
  })
  .refine((data) => data.start_date < data.end_date, {
    message: "Start date must be before end date.",
    path: ["end_date"],
  });

export const updateBudgetSchema = z
  .object({
    id: z.string().uuid("Invalid budget ID."),
    organization_id: z.string().uuid("Invalid organization ID."),
    name: z
      .string()
      .min(1, "Name is required.")
      .max(150, "Name must be 150 characters or fewer."),
    start_date: z.string().min(1, "Start date is required."),
    end_date: z.string().min(1, "End date is required."),
    status: z.enum(BUDGET_STATUSES, {
      message: "Invalid budget status.",
    }),
    notes: z
      .string()
      .max(1000, "Notes must be 1000 characters or fewer.")
      .optional()
      .or(z.literal("")),
    line_items: z.string().min(1, "Line items are required."),
  })
  .refine((data) => data.start_date < data.end_date, {
    message: "Start date must be before end date.",
    path: ["end_date"],
  });

export const duplicateBudgetSchema = z
  .object({
    source_budget_id: z.string().uuid("Invalid budget ID."),
    organization_id: z.string().uuid("Invalid organization ID."),
    name: z
      .string()
      .min(1, "Name is required.")
      .max(150, "Name must be 150 characters or fewer."),
    start_date: z.string().min(1, "Start date is required."),
    end_date: z.string().min(1, "End date is required."),
  })
  .refine((data) => data.start_date < data.end_date, {
    message: "Start date must be before end date.",
    path: ["end_date"],
  });

export const updateBudgetStatusSchema = z.object({
  id: z.string().uuid("Invalid budget ID."),
  organization_id: z.string().uuid("Invalid organization ID."),
  status: z.enum(BUDGET_STATUSES, {
    message: "Invalid budget status.",
  }),
});

export type CreateBudgetInput = z.infer<typeof createBudgetSchema>;
export type UpdateBudgetInput = z.infer<typeof updateBudgetSchema>;
export type DuplicateBudgetInput = z.infer<typeof duplicateBudgetSchema>;
export type UpdateBudgetStatusInput = z.infer<typeof updateBudgetStatusSchema>;
export type BudgetLineItemInput = z.infer<typeof budgetLineItemSchema>;
