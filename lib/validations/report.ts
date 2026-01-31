import { z } from "zod";

export const reportParamsSchema = z.object({
  start_date: z
    .string()
    .min(1, "Start date is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD format."),
  end_date: z
    .string()
    .min(1, "End date is required.")
    .regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD format."),
  account_id: z.string().uuid("Invalid account ID.").optional(),
  category_id: z.string().uuid("Invalid category ID.").optional(),
  status: z
    .string()
    .optional()
    .transform((val) => {
      if (!val || val === "all") return undefined;
      return val.split(",").filter(Boolean);
    }),
});

export type ReportParams = z.infer<typeof reportParamsSchema>;
