---
name: react-hook-form
description: |
  Manages form state, validation, and submission with React Hook Form integration.
  Use when: building forms with useForm and zodResolver, implementing split transaction forms with useFieldArray, integrating forms with Server Actions, handling form errors, or optimizing form performance.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# React Hook Form Skill

React Hook Form v7 with `zodResolver` for validation. Forms live in `components/forms/`. Zod schemas in `lib/validations/` serve as the single source of truth for both client validation and Server Action validation. The transaction form uses `useFieldArray` for split line items with sum validation.

## Quick Start

### Basic Form

```tsx
// components/forms/organization-form.tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { organizationSchema, type OrganizationFormData } from "@/lib/validations/organization";

export function OrganizationForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<OrganizationFormData>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { name: "", ein: "", fiscal_year_start_month: 1 },
  });

  async function onSubmit(data: OrganizationFormData) {
    await createOrganization(data);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <input {...register("name")} />
      {errors.name && <p className="text-sm text-red-600">{errors.name.message}</p>}
      <button type="submit" disabled={isSubmitting}>Create</button>
    </form>
  );
}
```

### Split Transaction Form with useFieldArray

```tsx
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { transactionSchema, type TransactionFormData } from "@/lib/validations/transaction";

export function TransactionForm({ orgId }: Readonly<{ orgId: string }>) {
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      transaction_type: "expense",
      amount: 0,
      line_items: [{ category_id: "", amount: 0, memo: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "line_items",
  });

  const watchLineItems = form.watch("line_items");
  const lineItemsTotal = watchLineItems.reduce((sum, li) => sum + (Number(li.amount) || 0), 0);

  return (
    <form onSubmit={form.handleSubmit(onSubmit)}>
      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...form.register(`line_items.${index}.amount`, { valueAsNumber: true })} />
          {fields.length > 1 && <button type="button" onClick={() => remove(index)}>Remove</button>}
        </div>
      ))}
      <button type="button" onClick={() => append({ category_id: "", amount: 0, memo: "" })}>
        Add Line Item
      </button>
    </form>
  );
}
```

## Key Concepts

| Concept | Pattern |
|---------|---------|
| Resolver | `zodResolver(schema)` bridges RHF and Zod |
| `useFieldArray` | Dynamic line items for split transactions |
| `watch` | Live values for derived computations (balance check) |
| `register` | Connects inputs to form state |
| `handleSubmit` | Validates then calls `onSubmit` |
| `formState.errors` | Field-level error messages from Zod |
| Derived state | Compute totals from `watch()`, never `useState` |

## See Also

- [hooks](references/hooks.md) — useForm, useFieldArray, useFormContext, useWatch
- [components](references/components.md) — Form architecture, useController, shadcn/ui integration
- [data-fetching](references/data-fetching.md) — Server Action submission, edit form loading
- [state](references/state.md) — Form state categories, derived values
- [forms](references/forms.md) — Zod schemas, full transaction form, currency input, workflow checklist
- [performance](references/performance.md) — Re-render isolation, watch vs useWatch

## Related Skills

- See the **zod** skill for validation schema design
- See the **react** skill for component and hook patterns
- See the **nextjs** skill for Server Action integration
- See the **typescript** skill for form type inference
- See the **tanstack-query** skill for mutation + form integration

## Documentation Resources

> Fetch latest React Hook Form documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "react-hook-form"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/react-hook-form`

**Recommended Queries:**
- "React Hook Form useFieldArray dynamic fields"
- "React Hook Form zodResolver integration"
- "React Hook Form watch useWatch performance"
- "React Hook Form Server Action submission"
