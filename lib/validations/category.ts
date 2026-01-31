import { z } from "zod";

export const CATEGORY_TYPES = ["income", "expense"] as const;

export const CATEGORY_TYPE_LABELS: Record<
  (typeof CATEGORY_TYPES)[number],
  string
> = {
  income: "Income",
  expense: "Expense",
};

export const createCategorySchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Category name is required.")
    .max(100, "Category name must be 100 characters or fewer."),
  category_type: z.enum(CATEGORY_TYPES, {
    message: "Invalid category type.",
  }),
  parent_id: z
    .string()
    .uuid("Invalid parent category ID.")
    .optional()
    .or(z.literal("")),
});

export const updateCategorySchema = createCategorySchema.extend({
  id: z.string().uuid("Invalid category ID."),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
