# Zod Workflows Reference

## Contents
- New Entity Schema Workflow
- Form Validation End-to-End
- API Route Query Validation
- Server Action Validation
- Schema Testing
- Debugging Validation Errors

## New Entity Schema Workflow

When adding a new entity (e.g., accounts, categories), follow this checklist.

Copy this checklist and track progress:
- [ ] Step 1: Create schema file in `lib/validations/{entity}.ts`
- [ ] Step 2: Define create schema with all required fields
- [ ] Step 3: Export `type {Entity}FormData = z.infer<typeof schema>`
- [ ] Step 4: Derive update schema with `.partial()` if needed
- [ ] Step 5: Import schema in Server Action for server-side validation
- [ ] Step 6: Import schema in form component with `zodResolver`
- [ ] Step 7: Verify form errors display correctly

```typescript
// Step 1-3: lib/validations/category.ts
import { z } from "zod";

export const CATEGORY_TYPES = ["income", "expense"] as const;

export const categoryCreateSchema = z.object({
  name: z.string().min(1, "Category name is required").max(255),
  category_type: z.enum(CATEGORY_TYPES),
  parent_id: z.string().uuid().nullable().default(null),
});

export type CategoryFormData = z.infer<typeof categoryCreateSchema>;

// Step 4: derive update schema
export const categoryUpdateSchema = categoryCreateSchema.partial();
```

## Form Validation End-to-End

The schema is the only validation pass. Forms are plain `<form>` elements bound to a Server Action with `useActionState`; there is no client-side resolver. See the **forms** skill for the form side.

```tsx
// account-form.tsx — the client half holds no validation at all.
"use client";

import { useActionState } from "react";
import { createAccount } from "./actions";

export function AccountForm() {
  const [state, formAction, pending] = useActionState(createAccount, null);

  return (
    <form action={formAction}>
      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      <input name="name" required />
      <input name="opening_balance" type="number" step="0.01" />
      <button type="submit" disabled={pending}>Create</button>
    </form>
  );
}
```

```ts
// actions.ts — where validation actually happens.
"use server";

export async function createAccount(
  _prevState: { error: string } | null,
  formData: FormData
) {
  const parsed = createAccountSchema.safeParse({
    organization_id: formData.get("organization_id") as string,
    name: formData.get("name") as string,
    opening_balance: formData.get("opening_balance") as string,
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  // ... insert, then revalidatePath() and redirect()
}
```

Two consequences of validating only on the server:

- **Every value is a string.** `FormData` has no types, so numeric and boolean fields need `z.coerce.number()` or a `preprocess` — a schema expecting `z.number()` will reject a perfectly good form.
- **The action is the security boundary.** A Server Action is directly invocable, so a rule that exists only in the UI does not exist. Cross-field rules belong in `superRefine`, not in a disabled button.


## API Route Query Validation

For API Routes that accept query parameters (transaction list, report export), validate with `safeParse` before querying the database.

```typescript
// app/api/reports/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const reportQuerySchema = z.object({
  start_date: z.string().date("Invalid start date"),
  end_date: z.string().date("Invalid end date"),
  account_id: z.string().uuid().optional(),
  status: z.string().transform((s) => s.split(",")).pipe(
    z.array(z.enum(["uncleared", "cleared", "reconciled"]))
  ).optional(),
}).refine(
  (d) => new Date(d.start_date) <= new Date(d.end_date),
  { message: "Start date must be before end date", path: ["start_date"] }
);

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const result = reportQuerySchema.safeParse(params);

  if (!result.success) {
    return NextResponse.json(
      { errors: result.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { start_date, end_date, account_id, status } = result.data;
  // Query database with validated, typed params
}
```

## Server Action Validation

Server Actions receive `unknown` data. Always validate before database operations.

```typescript
// app/(dashboard)/organizations/[orgId]/transactions/actions.ts
"use server";

import { transactionSchema } from "@/lib/validations/transaction";
import { createServerClient } from "@/lib/supabase/server";

export async function createTransaction(orgId: string, rawData: unknown) {
  // 1. Validate input
  const result = transactionSchema.safeParse(rawData);
  if (!result.success) {
    return { error: result.error.flatten().fieldErrors };
  }

  // 2. result.data is fully typed — proceed with DB insert
  const supabase = await createServerClient();
  const { data, error } = await supabase
    .from("transactions")
    .insert({
      account_id: result.data.account_id,
      transaction_date: result.data.transaction_date,
      amount: result.data.amount,
      transaction_type: result.data.transaction_type,
      description: result.data.description,
      check_number: result.data.check_number,
      status: result.data.status,
    })
    .select()
    .single();

  if (error) return { error: { form: [error.message] } };
  return { data };
}
```

## Schema Testing

Zod schemas are pure functions — test them without mocking.

1. Validate: run tests
2. If tests fail, fix schema and repeat
3. Only proceed when all assertions pass

```typescript
// lib/validations/__tests__/transaction.test.ts
import { describe, it, expect } from "vitest";
import { transactionSchema } from "../transaction";

describe("transactionSchema", () => {
  const validTransaction = {
    amount: 500,
    transaction_type: "expense",
    description: "Office Supplies",
    account_id: "550e8400-e29b-41d4-a716-446655440000",
    transaction_date: "2025-06-15",
    status: "uncleared",
    line_items: [
      { category_id: "550e8400-e29b-41d4-a716-446655440001", amount: 350 },
      { category_id: "550e8400-e29b-41d4-a716-446655440002", amount: 150 },
    ],
  };

  it("accepts valid split transaction", () => {
    expect(transactionSchema.safeParse(validTransaction).success).toBe(true);
  });

  it("rejects line items that do not sum to total", () => {
    const bad = { ...validTransaction, amount: 600 };
    const result = transactionSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("rejects empty line items", () => {
    const bad = { ...validTransaction, line_items: [] };
    const result = transactionSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it("coerces string amounts from form input", () => {
    const withStrings = {
      ...validTransaction,
      amount: "500",
      line_items: [
        { category_id: "550e8400-e29b-41d4-a716-446655440001", amount: "350" },
        { category_id: "550e8400-e29b-41d4-a716-446655440002", amount: "150" },
      ],
    };
    expect(transactionSchema.safeParse(withStrings).success).toBe(true);
  });
});
```

## Debugging Validation Errors

When `safeParse` returns `success: false`, inspect the full error structure:

```typescript
const result = schema.safeParse(data);
if (!result.success) {
  // Full issue list with paths and codes
  console.log(JSON.stringify(result.error.issues, null, 2));

  // Flat structure for forms
  console.log(result.error.flatten());

  // Nested structure matching object shape
  console.log(result.error.format());
}
```

| Method | Use Case |
|--------|----------|
| `.issues` | Programmatic error inspection, logging |
| `.flatten()` | Form field errors in Server Action responses |
| `.format()` | Nested object structures, deeply nested form errors |

**Common pitfall:** `.refine()` errors appear in `flat.formErrors` (root-level), not `flat.fieldErrors`, unless you specify a `path` option. Always set `path` when the error relates to a specific field.