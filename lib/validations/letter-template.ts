import { z } from "zod";

import { findUnknownPlaceholders } from "@/lib/letters/placeholders";

const PLACEHOLDER_FIELDS = ["heading", "body", "closing"] as const;

const baseLetterTemplateSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  name: z
    .string()
    .min(1, "Name is required.")
    .max(100, "Name must be 100 characters or fewer."),
  heading: z
    .string()
    .max(150, "Heading must be 150 characters or fewer.")
    .optional()
    .or(z.literal("")),
  body: z
    .string()
    .min(1, "Letter body is required.")
    .max(5000, "Letter body must be 5000 characters or fewer."),
  closing: z
    .string()
    .max(300, "Closing must be 300 characters or fewer.")
    .optional()
    .or(z.literal("")),
  is_default: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
});

type PlaceholderCarrier = {
  heading?: string;
  body: string;
  closing?: string;
};

/**
 * Rejects placeholders outside the known vocabulary at save time, so a typo
 * surfaces in the form instead of printing literally on every letter.
 */
function checkPlaceholders(
  data: PlaceholderCarrier,
  ctx: z.RefinementCtx
): void {
  for (const field of PLACEHOLDER_FIELDS) {
    const value = data[field];
    if (!value) continue;

    const unknown = findUnknownPlaceholders(value);
    if (unknown.length === 0) continue;

    const rendered = unknown.map((token) => `{{${token}}}`).join(", ");
    ctx.addIssue({
      code: "custom",
      path: [field],
      message: `Unknown placeholder${unknown.length > 1 ? "s" : ""}: ${rendered}`,
    });
  }
}

export const createLetterTemplateSchema =
  baseLetterTemplateSchema.superRefine(checkPlaceholders);

export const updateLetterTemplateSchema = baseLetterTemplateSchema
  .extend({
    id: z.string().uuid("Invalid template ID."),
  })
  .superRefine(checkPlaceholders);

export const letterTemplateIdSchema = z.object({
  id: z.string().uuid("Invalid template ID."),
  organization_id: z.string().uuid("Invalid organization ID."),
});

export type CreateLetterTemplateInput = z.infer<typeof createLetterTemplateSchema>;
export type UpdateLetterTemplateInput = z.infer<typeof updateLetterTemplateSchema>;
export type LetterTemplateIdInput = z.infer<typeof letterTemplateIdSchema>;
