# Zod Patterns Reference

## Contents
- Schema Organization
- Type Inference as Single Source of Truth
- Coercion for Form Inputs
- Cross-Field Validation with Refine
- Error Handling for UI
- Enum and Status Validation
- Reusable Schema Composition
- Anti-Patterns

## Schema Organization

All validation schemas live in `lib/validations/`, one file per entity. Each file exports the schema and its inferred type.

```typescript
// lib/validations/account.ts
import { z } from "zod";

const ACCOUNT_TYPES = ["checking", "savings", "paypal", "cash", "other"] as const;

export const accountSchema = z.object({
  name: z.string().min(1, "Account name is required").max(255),
  account_type: z.enum(ACCOUNT_TYPES),
  description: z.string().max(500).optional(),
  opening_balance: z.coerce.number().default(0),
  is_active: z.boolean().default(true),
});

export type AccountFormData = z.infer<typeof accountSchema>;
```

## Type Inference as Single Source of Truth

NEVER duplicate types manually when a Zod schema exists. Use `z.infer` to derive the type.

```typescript
// GOOD — single source of truth
export const categorySchema = z.object({
  name: z.string().min(1),
  category_type: z.enum(["income", "expense"]),
  parent_id: z.string().uuid().nullable(),
});
export type CategoryFormData = z.infer<typeof categorySchema>;

// BAD — type drifts from schema
interface CategoryFormData {
  name: string;
  category_type: "income" | "expense";
  parent_id: string | null;
}
```

**Why this breaks:** When you update the schema (add a field, change constraints), the manually written interface silently drifts. `z.infer` guarantees they stay in sync.

## Coercion for Form Inputs

HTML form inputs always produce strings. Use `z.coerce` to convert to the target type instead of manual parsing.

```typescript
// GOOD — coerce handles string-to-number conversion
const transactionHeaderSchema = z.object({
  amount: z.coerce.number().positive("Amount must be greater than zero"),
  transaction_date: z.coerce.date(),
  fiscal_year_start_month: z.coerce.number().int().min(1).max(12),
});

// BAD — manual parsing is fragile and loses Zod error context
const amount = parseFloat(formData.get("amount") as string);
if (isNaN(amount)) throw new Error("Invalid amount");
```

## Cross-Field Validation with Refine

Use `.refine()` for single cross-field checks. Use `.superRefine()` when you need to attach multiple issues to specific paths.

```typescript
// Transaction: line items must sum to total
export const transactionSchema = z.object({
  amount: z.coerce.number().positive(),
  transaction_type: z.enum(["income", "expense"]),
  description: z.string().min(1).max(255),
  check_number: z.string().max(50).optional(),
  status: z.enum(["uncleared", "cleared", "reconciled"]).default("uncleared"),
  account_id: z.string().uuid(),
  transaction_date: z.string().date(),
  line_items: z.array(z.object({
    category_id: z.string().uuid(),
    amount: z.coerce.number().positive(),
    memo: z.string().max(255).optional(),
  })).min(1, "At least one line item is required"),
}).superRefine((data, ctx) => {
  const sum = data.line_items.reduce((acc, li) => acc + li.amount, 0);
  if (Math.abs(sum - data.amount) >= 0.01) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `Line items sum ($${sum.toFixed(2)}) must equal transaction total ($${data.amount.toFixed(2)})`,
      path: ["line_items"],
    });
  }
});
```

## Error Handling for UI

Use `.flatten()` for form field errors. Use `.format()` for nested structures.

```typescript
// Server Action pattern
const result = transactionSchema.safeParse(rawData);
if (!result.success) {
  const flat = result.error.flatten();
  // flat.fieldErrors: { amount?: string[], description?: string[], ... }
  // flat.formErrors: string[] (root-level errors from .refine)
  return { fieldErrors: flat.fieldErrors, formErrors: flat.formErrors };
}
```

## Enum and Status Validation

Extract enum arrays as `const` so they can be reused in both schemas and UI dropdowns.

```typescript
// lib/validations/transaction.ts
export const TRANSACTION_STATUSES = ["uncleared", "cleared", "reconciled"] as const;
export const TRANSACTION_TYPES = ["income", "expense"] as const;

export const statusSchema = z.enum(TRANSACTION_STATUSES);
export type TransactionStatus = z.infer<typeof statusSchema>;
```

This const array can be shared with UI components for rendering `<select>` options without duplication. See the **react-hook-form** skill for form integration.

## Reusable Schema Composition

Use `.pick()`, `.omit()`, `.extend()`, and `.merge()` to derive related schemas without duplication.

```typescript
// Full schema for creation
export const organizationCreateSchema = z.object({
  name: z.string().min(1).max(255),
  ein: z.string().regex(/^\d{2}-\d{7}$/).optional().or(z.literal("")),
  fiscal_year_start_month: z.coerce.number().int().min(1).max(12).default(1),
});

// Update schema — all fields optional
export const organizationUpdateSchema = organizationCreateSchema.partial();

// Query filter — only the fields needed for filtering
export const organizationFilterSchema = organizationCreateSchema.pick({ name: true });
```

## Anti-Patterns

### WARNING: Using `.parse()` in Server Actions Without Catching

**The Problem:**

```typescript
// BAD — unhandled ZodError crashes the server action
export async function createOrg(data: unknown) {
  const validated = orgSchema.parse(data); // throws on invalid input
}
```

**Why This Breaks:**
1. Unhandled exceptions in Server Actions surface as opaque "Server Error" to users
2. No structured field errors are returned to the form
3. Server logs fill with stack traces for routine validation failures

**The Fix:**

```typescript
// GOOD — safeParse returns structured result
export async function createOrg(data: unknown) {
  const result = orgSchema.safeParse(data);
  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }
  // proceed with result.data
}
```

### WARNING: Validating Only on the Client

**The Problem:** Relying solely on `zodResolver` in the form without re-validating in the Server Action.

**Why This Breaks:**
1. Client validation can be bypassed (browser DevTools, direct API calls)
2. Stale client code may use outdated schemas after deployment
3. Server Actions receive `unknown` data — trust nothing from the client

**The Fix:** Validate in both places. The client-side validation gives instant UX feedback. The server-side validation is the security boundary.