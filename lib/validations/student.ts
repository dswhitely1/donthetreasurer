import { z } from "zod";

export const createStudentSchema = z.object({
  organization_id: z.string().uuid("Invalid organization ID."),
  first_name: z
    .string()
    .min(1, "First name is required.")
    .max(100, "First name must be 100 characters or fewer."),
  last_name: z
    .string()
    .min(1, "Last name is required.")
    .max(100, "Last name must be 100 characters or fewer."),
  email: z
    .string()
    .email("Invalid email address.")
    .max(255, "Email must be 255 characters or fewer.")
    .optional()
    .or(z.literal("")),
  phone: z
    .string()
    .max(30, "Phone must be 30 characters or fewer.")
    .optional()
    .or(z.literal("")),
  guardian_name: z
    .string()
    .max(200, "Guardian name must be 200 characters or fewer.")
    .optional()
    .or(z.literal("")),
  guardian_email: z
    .string()
    .email("Invalid guardian email address.")
    .max(255, "Guardian email must be 255 characters or fewer.")
    .optional()
    .or(z.literal("")),
  guardian_phone: z
    .string()
    .max(30, "Guardian phone must be 30 characters or fewer.")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(2000, "Notes must be 2000 characters or fewer.")
    .optional()
    .or(z.literal("")),
});

export const updateStudentSchema = createStudentSchema.extend({
  id: z.string().uuid("Invalid student ID."),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentInput = z.infer<typeof updateStudentSchema>;
