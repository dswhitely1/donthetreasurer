---
name: zod
description: |
  Validates schemas, forms, and API requests with Zod TypeScript-first validation.
  Use when: defining validation schemas for entities (organizations, accounts, categories, transactions, line items), validating Server Action inputs, validating API Route query parameters, or inferring TypeScript types from schemas.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Zod Skill

Zod provides runtime validation with static TypeScript type inference. In this codebase, Zod schemas live in `lib/validations/` and serve as the single source of truth for both runtime validation and TypeScript types across Server Actions and API Routes. Schemas map directly to the domain model: organizations, accounts, categories, transactions, and line items.

## Quick Start

### Entity Schema

```typescript
// lib/validations/organization.ts
import { z } from "zod";

export const organizationSchema = z.object({
  name: z.string().min(1, "Organization name is required").max(255),
  ein: z.string().regex(/^\d{2}-\d{7}$/, "EIN must be XX-XXXXXXX format").optional().or(z.literal("")),
  fiscal_year_start_month: z.coerce.number().int().min(1).max(12).default(1),
  is_active: z.boolean().default(true),
});

export type OrganizationFormData = z.infer<typeof organizationSchema>;
```

### Server Action Validation

```typescript
// app/(dashboard)/organizations/actions.ts
"use server";

import { organizationSchema } from "@/lib/validations/organization";

export async function createOrganization(formData: unknown) {
  const result = organizationSchema.safeParse(formData);
  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }
  // result.data is fully typed as OrganizationFormData
}
```

### Form Integration

Forms in this codebase are plain `<form>` elements bound to Server Actions with `useActionState`; the schema validates on the server, not in the browser. There is no client-side resolver. See the **forms** skill.

```typescript
// In the Server Action — the schema is the only validation pass.
const parsed = createOrganizationSchema.safeParse({
  name: formData.get("name") as string,
  fiscal_year_start_month: formData.get("fiscal_year_start_month") as string,
});

if (!parsed.success) return { error: parsed.error.issues[0].message };
```

Because every value arrives from `FormData` as a string, numeric and boolean fields need `z.coerce` or a `preprocess`.

## Key Concepts

| Concept | Usage | Example |
|---------|-------|---------|
| `z.infer<typeof schema>` | Derive TS type from schema | `type Org = z.infer<typeof orgSchema>` |
| `.safeParse()` | Validate without throwing | `const r = schema.safeParse(data)` |
| `.parse()` | Validate and throw on failure | `const data = schema.parse(input)` |
| `z.coerce` | Coerce form strings to target type | `z.coerce.number()` for numeric inputs |
| `.refine()` | Cross-field validation | Line items sum must equal total |
| `.flatten()` | Structured error output for forms | `error.flatten().fieldErrors` |

## Common Patterns

### Split Transaction Validation

**When:** Validating that line item amounts sum to the transaction total.

```typescript
export const transactionSchema = z.object({
  amount: z.coerce.number().positive("Amount must be positive"),
  transaction_type: z.enum(["income", "expense"]),
  description: z.string().min(1).max(255),
  line_items: z.array(z.object({
    category_id: z.string().uuid(),
    amount: z.coerce.number().positive(),
    memo: z.string().max(255).optional(),
  })).min(1, "At least one line item required"),
}).refine(
  (data) => {
    const sum = data.line_items.reduce((acc, li) => acc + li.amount, 0);
    return Math.abs(sum - data.amount) < 0.01;
  },
  { message: "Line items must sum to transaction total", path: ["line_items"] }
);
```

### Query Parameter Validation

**When:** Validating API Route search params for transaction list or report endpoints.

```typescript
export const transactionQuerySchema = z.object({
  start_date: z.string().date(),
  end_date: z.string().date(),
  account_id: z.string().uuid().optional(),
  status: z.enum(["uncleared", "cleared", "reconciled"]).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
```

## See Also

- [patterns](references/patterns.md) — Schema design, coercion, cross-field validation, error handling
- [workflows](references/workflows.md) — End-to-end form validation, Server Action integration, testing schemas

## Related Skills

- See the **forms** skill for how schemas are applied to Server Actions
- See the **typescript** skill for strict mode type inference patterns
- See the **supabase** skill for aligning schemas with database types
- See the **nextjs** skill for Server Action and API Route validation patterns

## Documentation Resources

> Fetch latest Zod documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "zod"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/v3_zod_dev` _(note: this project is on Zod 4 — prefer the v4 docs when the resolved id offers them)_

**Recommended Queries:**
- "zod refine superRefine custom validation"
- "zod coerce transform preprocessing"
- "zod error handling flatten format"
- "zod discriminated union"