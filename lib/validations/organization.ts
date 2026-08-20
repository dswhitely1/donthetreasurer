import { z } from "zod";

export const createOrganizationSchema = z.object({
  name: z
    .string()
    .min(1, "Organization name is required.")
    .max(100, "Organization name must be 100 characters or fewer."),
  ein: z
    .string()
    .regex(/^\d{2}-\d{7}$/, "EIN must be in XX-XXXXXXX format.")
    .optional()
    .or(z.literal("")),
  fiscal_year_start_month: z.coerce
    .number()
    .int()
    .min(1)
    .max(12)
    .default(1),
  director_name: z
    .string()
    .max(100, "Director name must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  director_title: z
    .string()
    .max(100, "Director title must be 100 characters or fewer.")
    .optional()
    .or(z.literal("")),
  director_email: z
    .string()
    .email("Director email must be a valid email address.")
    .max(255, "Director email must be 255 characters or fewer.")
    .optional()
    .or(z.literal("")),
  director_phone: z
    .string()
    .max(30, "Director phone must be 30 characters or fewer.")
    .optional()
    .or(z.literal("")),
  seasons_enabled: z
    .preprocess((val) => val === "true" || val === true, z.boolean())
    .default(false),
});

export const updateOrganizationSchema = createOrganizationSchema.extend({
  id: z.string().uuid("Invalid organization ID."),
});

export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
