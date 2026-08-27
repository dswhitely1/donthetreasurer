import { z } from "zod";

export const createCategorySchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Category name is required.")
    .max(100, "Category name must be 100 characters or fewer."),
  parent_id: z
    .string()
    .uuid("Invalid parent category ID.")
    .optional()
    .or(z.literal("")),
});

export const updateCategorySchema = createCategorySchema.extend({
  id: z.string().uuid("Invalid category ID."),
});

export const mergeCategorySchema = z
  .object({
    source_id: z.string().uuid("Invalid source category ID."),
    target_id: z.string().uuid("Invalid target category ID."),
    organization_id: z.string().uuid("Invalid organization ID."),
  })
  .refine((data) => data.source_id !== data.target_id, {
    message: "Cannot merge a category into itself.",
  });

export const reassignCategorySchema = z
  .object({
    id: z.string().uuid("Invalid category ID."),
    organization_id: z.string().uuid("Invalid organization ID."),
    new_parent_id: z.string().uuid("Invalid parent category ID."),
  })
  .refine((data) => data.id !== data.new_parent_id, {
    message: "Cannot reassign a category under itself.",
  });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type MergeCategoryInput = z.infer<typeof mergeCategorySchema>;
export type ReassignCategoryInput = z.infer<typeof reassignCategorySchema>;
