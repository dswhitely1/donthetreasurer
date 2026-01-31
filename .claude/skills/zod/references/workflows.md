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

This workflow connects Zod schemas to React Hook Form and Server Actions. See the **react-hook-form** skill for detailed form patterns.

```typescript
// components/forms/account-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { accountSchema, type AccountFormData } from "@/lib/validations/account";

export function AccountForm() {
  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      name: "",
      account_type: "checking",
      opening_balance: 0,
      is_active: true,
    },
  });

  async function onSubmit(data: AccountFormData) {
    // data is already validated by Zod via zodResolver
    const result = await createAccount(data);
    if (result?.error) {
      // Server returned field errors — set them on the form
      Object.entries(result.error).forEach(([field, messages]) => {
        form.setError(field as keyof AccountFormData, {
          message: (messages as string[])[0],
        });
      });
    }
  }

  return <form onSubmit={form.handleSubmit(onSubmit)}>{/* fields */}</form>;
}
```

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