---
name: typescript
description: |
  Enforces strict TypeScript type safety, interfaces, and type inference patterns.
  Use when: defining domain types, working with generated Supabase types, creating discriminated unions for action results, handling compiler errors, enforcing import order conventions, or managing server/client module boundaries.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# TypeScript Skill

TypeScript 5.x with strict mode enabled. Module resolution is `bundler`. Path alias `@/*` maps to project root. Generated Supabase types are the single source of truth for database types. Zod schemas are the single source of truth for form/validation types via `z.infer`. Component props always use `Readonly<>`.

## Quick Start

### Readonly Props (established convention)

```typescript
export default function TransactionForm({
  accountId,
  onSubmit,
}: Readonly<{
  accountId: string;
  onSubmit: (data: TransactionInsert) => Promise<void>;
}>) {
  // ...
}
```

### Discriminated Union for Action Results

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResult(result: ActionResult<Organization>) {
  if (result.success) {
    console.log(result.data.name); // narrowed to Organization
  } else {
    console.error(result.error); // narrowed to string
  }
}
```

### Type-Only Imports

```typescript
import type { Database } from "@/types/database";
import type { Organization, Account } from "@/types";
```

### Const Assertions for Domain Enums

```typescript
const ACCOUNT_TYPES = ["checking", "savings", "paypal", "cash", "other"] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];
```

## Key Concepts

| Concept | Pattern |
|---------|---------|
| Database types | Generated via `supabase gen types typescript` |
| Form types | Inferred from Zod: `z.infer<typeof schema>` |
| Props | Always `Readonly<>` wrapped |
| Enums | `as const` arrays, not TS `enum` |
| Exhaustive check | `never` in switch default |
| Error handling | `ActionResult<T>` discriminated union |
| Imports | `import type` for type-only imports |

## See Also

- [patterns](references/patterns.md) — Readonly props, discriminated unions, exhaustive switches, guard clauses
- [types](references/types.md) — Generated Supabase types, domain types, utility types, branded UUIDs
- [modules](references/modules.md) — Import ordering, path aliases, module boundaries, server/client separation
- [errors](references/errors.md) — ActionResult pattern, Supabase error handling, common compiler errors

## Related Skills

- See the **zod** skill for schema definitions and `z.infer` type inference
- See the **supabase** skill for generated database types
- See the **nextjs** skill for Server Action and API Route patterns
- See the **react** skill for component prop conventions
- See the **react-hook-form** skill for form type integration
- See the **tanstack-query** skill for typed query hooks

## Documentation Resources

> Fetch latest TypeScript documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "typescript"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Recommended Queries:**
- "TypeScript discriminated union narrowing"
- "TypeScript const assertion literal types"
- "TypeScript strict mode configuration"
- "TypeScript generics constraints"
