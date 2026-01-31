# Forms Reference

## Contents
- Form Stack
- WARNING: Missing Form Library
- Basic Form Pattern
- Transaction Form (Split Line Items)
- Validation with Zod
- Server Action Integration
- Form Workflow Checklist

## Form Stack

| Concern | Tool | Purpose |
|---------|------|---------|
| Field registration | React Hook Form | Tracks values, dirty state, touched state |
| Validation | Zod schemas | Shared between client and server |
| Resolver | `@hookform/resolvers/zod` | Bridges RHF and Zod |
| Submission | Server Actions | Handles mutations server-side |

See the **react-hook-form** skill for advanced field patterns. See the **zod** skill for schema design.

## WARNING: Missing Form Library

**Detected:** `react-hook-form`, `zod`, and `@hookform/resolvers` are not in `package.json`

**Impact:** Without these, form handling requires manual `useState` for every field, manual validation, and no shared schemas between client and server.

```bash
npm install react-hook-form zod @hookform/resolvers
```

## Basic Form Pattern

```tsx
// components/forms/organization-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { organizationSchema, type OrganizationFormData } from "@/lib/validations/organization";
import { createOrganization } from "@/app/(dashboard)/organizations/actions";

export function OrganizationForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: {
      name: "",
      ein: "",
      fiscal_year_start_month: 1,
    },
  });

  async function onSubmit(data: OrganizationFormData) {
    await createOrganization(data);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="text-sm font-medium">Organization Name</label>
        <input id="name" {...register("name")} className="w-full rounded border px-3 py-2" />
        {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      </div>

      <div>
        <label htmlFor="ein" className="text-sm font-medium">EIN (optional)</label>
        <input id="ein" {...register("ein")} placeholder="XX-XXXXXXX" className="w-full rounded border px-3 py-2" />
        {errors.ein && <p className="text-sm text-red-600">{errors.ein.message}</p>}
      </div>

      <button type="submit" disabled={isSubmitting} className="rounded bg-zinc-900 px-4 py-2 text-white disabled:opacity-50">
        {isSubmitting ? "Creating..." : "Create Organization"}
      </button>
    </form>
  );
}
```

## Transaction Form (Split Line Items)

The most complex form in the app. Uses `useFieldArray` for dynamic line items with sum validation.

```tsx
// components/forms/transaction-form.tsx
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema, type TransactionFormData } from "@/lib/validations/transaction";
import { useCategories } from "@/hooks/use-categories";

export function TransactionForm({ orgId }: Readonly<{ orgId: string }>) {
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      transaction_date: new Date().toISOString().split("T")[0],
      transaction_type: "expense",
      amount: 0,
      description: "",
      status: "uncleared",
      line_items: [{ category_id: "", amount: 0, memo: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  const watchType = form.watch("transaction_type");
  const watchAmount = form.watch("amount");
  const watchLineItems = form.watch("line_items");

  const { data: categories } = useCategories(orgId, watchType);

  // Derived values - NOT useState
  const lineItemsTotal = watchLineItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);
  const remaining = watchAmount - lineItemsTotal;
  const isBalanced = Math.abs(remaining) < 0.01;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Transaction header fields */}
      <div className="grid grid-cols-2 gap-4">
        <input type="date" {...form.register("transaction_date")} />
        <input type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
      </div>

      {/* Line items */}
      <div className="space-y-2">
        <h3 className="font-medium">Categories</h3>
        {fields.map((field, index) => (
          <div key={field.id} className="flex gap-2">
            <select {...form.register(`line_items.${index}.category_id`)}>
              <option value="">Select category</option>
              {categories?.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              {...form.register(`line_items.${index}.amount`, { valueAsNumber: true })}
            />
            <input {...form.register(`line_items.${index}.memo`)} placeholder="Memo" />
            {fields.length > 1 && (
              <button type="button" onClick={() => remove(index)}>Remove</button>
            )}
          </div>
        ))}

        <button type="button" onClick={() => append({ category_id: "", amount: 0, memo: "" })}>
          Add Line Item
        </button>

        {/* Balance indicator */}
        <div className={isBalanced ? "text-green-600" : "text-red-600"}>
          {isBalanced ? "Balanced" : `Remaining: $${remaining.toFixed(2)}`}
        </div>
      </div>

      <button type="submit" disabled={!isBalanced || form.formState.isSubmitting}>
        Save Transaction
      </button>
    </form>
  );
}
```

## Validation with Zod

Schemas live in `lib/validations/` and are shared between client forms and Server Actions.

```tsx
// lib/validations/transaction.ts
import { z } from "zod";

const lineItemSchema = z.object({
  category_id: z.string().uuid("Select a category"),
  amount: z.number().positive("Amount must be positive"),
  memo: z.string().optional(),
});

export const transactionSchema = z.object({
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  account_id: z.string().uuid(),
  transaction_type: z.enum(["income", "expense"]),
  amount: z.number().positive("Amount must be positive"),
  description: z.string().min(1, "Description required").max(255),
  check_number: z.string().optional(),
  status: z.enum(["uncleared", "cleared", "reconciled"]).default("uncleared"),
  line_items: z.array(lineItemSchema).min(1, "At least one line item required"),
}).refine(
  (data) => {
    const sum = data.line_items.reduce((s, item) => s + item.amount, 0);
    return Math.abs(sum - data.amount) < 0.01;
  },
  { message: "Line items must sum to transaction total", path: ["line_items"] }
);

export type TransactionFormData = z.infer<typeof transactionSchema>;
```

## Server Action Integration

```tsx
// app/(dashboard)/organizations/[orgId]/transactions/actions.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "@/lib/validations/transaction";
import { revalidatePath } from "next/cache";

export async function createTransaction(orgId: string, formData: unknown) {
  const parsed = transactionSchema.safeParse(formData);
  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }

  const supabase = await createClient();
  const { line_items, ...txnData } = parsed.data;

  const { data: txn, error: txnError } = await supabase
    .from("transactions")
    .insert(txnData)
    .select()
    .single();

  if (txnError) return { error: txnError.message };

  const { error: lineError } = await supabase
    .from("transaction_line_items")
    .insert(line_items.map((item) => ({ ...item, transaction_id: txn.id })));

  if (lineError) return { error: lineError.message };

  revalidatePath(`/organizations/${orgId}/transactions`);
  return { data: txn };
}
```

## Form Workflow Checklist

Copy this checklist when building a new form:

- [ ] Create Zod schema in `lib/validations/{entity}.ts`
- [ ] Export `type {Entity}FormData = z.infer<typeof {entity}Schema>`
- [ ] Create form component in `components/forms/{entity}-form.tsx`
- [ ] Add `"use client"` directive
- [ ] Set up `useForm` with `zodResolver`
- [ ] Wire fields with `register()` or `Controller`
- [ ] Display field errors from `formState.errors`
- [ ] Create Server Action in co-located `actions.ts`
- [ ] Validate with same Zod schema in Server Action
- [ ] Call `revalidatePath` after successful mutation
- [ ] Test: submit with invalid data, verify error messages
- [ ] Test: submit with valid data, verify redirect/update
