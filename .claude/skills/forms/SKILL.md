---
name: forms
description: |
  Use when building or modifying any form in this codebase — create/edit pages, dialogs, filter bars, delete confirmations — or when a submitted value arrives missing, stale, or as the wrong type in a Server Action.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Forms Skill

Forms in this codebase are plain HTML `<form>` elements whose `action` is a Server Action, bound with React's `useActionState`. **There is no client-side form library.** `react-hook-form` is not a dependency and appears in no source file — if you are reaching for `useForm`, `zodResolver`, or `useFieldArray`, stop.

Validation happens server-side with Zod schemas from `lib/validations/`. The same schema is the single source of truth; there is no separate client validation pass.

## Core Pattern

Mirror `app/(dashboard)/organizations/[orgId]/students/student-form.tsx`:

```tsx
"use client";

import { useActionState, useId } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createStudent, updateStudent } from "./actions";

import type { Tables } from "@/types/database";

export function StudentForm({
  mode,
  orgId,
  defaultValues,
}: Readonly<{
  mode: "create" | "edit";
  orgId: string;
  defaultValues?: Tables<"students">;
}>) {
  const formId = useId();
  const action = mode === "create" ? createStudent : updateStudent;
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {mode === "edit" && defaultValues && (
        <input type="hidden" name="id" value={defaultValues.id} />
      )}
      <input type="hidden" name="organization_id" value={orgId} />

      {state?.error && (
        <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`${formId}-first-name`}>First Name</Label>
        <Input id={`${formId}-first-name`} name="first_name" required maxLength={100}
               defaultValue={defaultValues?.first_name ?? ""} />
      </div>

      <Button type="submit" disabled={pending}>Save</Button>
    </form>
  );
}
```

The paired Server Action returns `{ error: string } | null`, then `revalidatePath("/dashboard", "layout")` and `redirect()`. See the **nextjs** skill for the action side.

## Quick Reference

| Need | Do |
|---|---|
| Form state | `useActionState(action, null)` → `[state, formAction, pending]` |
| Error display | Render `state?.error` in a destructive banner |
| Label association | `useId()` prefix, not hardcoded ids |
| Prefill | `defaultValue` on uncontrolled inputs |
| Ids / org scope | Hidden inputs |
| Disable while saving | `pending` from `useActionState` |
| Repeating rows (line items) | Local `useState` array, serialized to one hidden JSON input |
| Validation | Zod in the action; no client resolver |

## The FormData Traps

All three have caused real bugs here. None produces a type error — the value simply never arrives, or arrives wrong.

**1. An unchecked checkbox is ABSENT from FormData, not `false`.**
`formData.get("is_active") ?? "true"` silently reactivates everything you try to deactivate. This codebase emits booleans as a hidden input driven by React state, so the field is always the literal `"true"` or `"false"`:

```tsx
<input type="hidden" name="is_active" value={isActive ? "true" : "false"} />
<Checkbox checked={isActive} onCheckedChange={(v) => setIsActive(v === true)} />
```

See `organizations/[orgId]/organization-actions.tsx`.

**2. A DISABLED Radix `Select` drops out of FormData entirely.**
A conditionally locked field submits nothing, and the action either rejects the form or overwrites the column. Carry the value in a hidden input instead, and leave `name` off the `Select` itself:

```tsx
<input type="hidden" name="level_id" value={levelId} />
<Select value={levelId} onValueChange={setLevelId} disabled={isLocked}>
```

Keep the hidden input **unconditional**. Toggling `name` on the `Select` and adding the hidden input only when locked also works, but it has two states to keep in sync and a way to submit the field twice. One input that is always the source is simpler and cannot desynchronize.

See `organizations/[orgId]/sponsorships/sponsorship-form.tsx`.

**3. A Radix `Select` cannot represent an empty-string value.**
An optional select has no way to say "none" — `<SelectItem value="">` is invalid. Use a sentinel in state and translate it back at the boundary:

```tsx
const NONE = "__none__";
const [categoryId, setCategoryId] = useState(defaultValues?.category_id ?? NONE);
<input type="hidden" name="category_id" value={categoryId === NONE ? "" : categoryId} />
```

See `organizations/[orgId]/accounts/fee-config-fields.tsx`.

## Common Mistakes

- Reaching for `useForm` / `zodResolver` — not installed; use the pattern above.
- Client-side validation as the guard. The action is the boundary; a Server Action is directly invocable, so every rule must hold there.
- Controlled inputs everywhere. Prefer `defaultValue` and let FormData read the DOM; reserve state for values that drive other UI (a running total, a conditional field).
- Assuming a numeric input arrives as a number. FormData values are strings; coerce with `z.coerce.number()`.

## Related Skills

- See the **nextjs** skill for the Server Action side and `revalidatePath`/`redirect`
- See the **zod** skill for schema design and `superRefine` cross-field rules
- See the **react** skill for component and hook conventions
- See the **frontend-design** skill for shadcn/ui styling
