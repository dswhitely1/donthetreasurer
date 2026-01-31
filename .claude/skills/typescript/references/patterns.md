# TypeScript Patterns Reference

## Contents
- Idiomatic Patterns for This Codebase
- Discriminated Unions for Domain State
- Exhaustive Switch Statements
- Const Assertions for Enums
- WARNING: Any Type Escape Hatch
- WARNING: Non-Null Assertion Abuse
- Async Patterns
- Guard Clauses Over Deep Nesting

## Idiomatic Patterns for This Codebase

### Readonly Props on All Components

Every React component in this project wraps props with `Readonly<>`. This prevents accidental mutation of props objects.

```typescript
// GOOD — established pattern in app/layout.tsx
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

```typescript
// BAD — mutable props, violates project convention
export default function TransactionForm({
  accountId,
  onSubmit,
}: {
  accountId: string;
  onSubmit: (data: TransactionInsert) => Promise<void>;
}) {}
```

### Type-Only Imports

Always use `import type` when importing only types. This is enforced by `isolatedModules: true` in tsconfig.json and produces cleaner output.

```typescript
import type { Database } from "@/types/database";
import type { Organization, Account } from "@/types";
```

## Discriminated Unions for Domain State

The transaction status lifecycle (uncleared -> cleared -> reconciled) and action results are ideal for discriminated unions.

```typescript
// Action results — discriminate on `success`
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResult(result: ActionResult<Organization>) {
  if (result.success) {
    // TypeScript narrows: result.data is Organization
    console.log(result.data.name);
  } else {
    // TypeScript narrows: result.error is string
    console.error(result.error);
  }
}
```

```typescript
// Page state machine
type PageState<T> =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "success"; data: T };
```

## Exhaustive Switch Statements

Use the `never` type to catch unhandled cases at compile time. Critical for domain enums like transaction status.

```typescript
type TransactionStatus = "uncleared" | "cleared" | "reconciled";

function getStatusLabel(status: TransactionStatus): string {
  switch (status) {
    case "uncleared": return "Uncleared";
    case "cleared": return "Cleared";
    case "reconciled": return "Reconciled";
    default: {
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
    }
  }
}
```

If a new status is added to the union, this function will produce a compile error until the new case is handled.

## Const Assertions for Enums

Prefer `as const` arrays over TypeScript `enum`. They produce real values usable at runtime and infer literal types.

```typescript
// GOOD — const assertion, works at runtime AND compile time
const ACCOUNT_TYPES = ["checking", "savings", "paypal", "cash", "other"] as const;
type AccountType = (typeof ACCOUNT_TYPES)[number];
// AccountType = "checking" | "savings" | "paypal" | "cash" | "other"

// Use in validation: ACCOUNT_TYPES.includes(input)

// BAD — TypeScript enum, creates unnecessary runtime object
enum AccountType {
  Checking = "checking",
  Savings = "savings",
}
```

## WARNING: Any Type Escape Hatch

**The Problem:**

```typescript
// BAD — defeats the entire type system
function processTransaction(data: any) {
  return data.amount * 2; // no type checking at all
}
```

**Why This Breaks:**
1. No autocomplete, no refactoring support, no error detection
2. Errors surface at runtime instead of compile time
3. Propagates — `any` infects everything it touches

**The Fix:**

```typescript
// GOOD — use `unknown` and narrow
function processTransaction(data: unknown): number {
  if (typeof data === "object" && data !== null && "amount" in data) {
    const { amount } = data as { amount: number };
    return amount * 2;
  }
  throw new Error("Invalid transaction data");
}

// BETTER — use a Zod schema (see the **zod** skill)
import { transactionSchema } from "@/lib/validations/transaction";

function processTransaction(data: unknown) {
  const parsed = transactionSchema.parse(data);
  return parsed.amount * 2;
}
```

**When You Might Be Tempted:** Third-party API responses, `JSON.parse` results, form data. Always validate with Zod at system boundaries instead.

## WARNING: Non-Null Assertion Abuse

**The Problem:**

```typescript
// BAD — assumes element exists, crashes if it doesn't
const balance = account.transactions!.reduce((sum, t) => sum + t.amount, 0);
```

**Why This Breaks:**
1. Runtime `TypeError: Cannot read properties of undefined` when assumption is wrong
2. Hides legitimate nullability that should be handled
3. Makes the code lie about its safety guarantees

**The Fix:**

```typescript
// GOOD — handle the null case
const balance = (account.transactions ?? []).reduce(
  (sum, t) => sum + t.amount, 0
);
```

## Async Patterns

### Server Actions

Server Actions in Next.js are async by default. Always return typed results.

```typescript
"use server";

export async function updateTransactionStatus(
  transactionId: string,
  newStatus: TransactionStatus
): Promise<ActionResult<Transaction>> {
  // Supabase call, return typed result
}
```

### Parallel Data Fetching in Server Components

```typescript
// GOOD — parallel fetching
const [accounts, categories] = await Promise.all([
  getAccounts(orgId),
  getCategories(orgId),
]);

// BAD — sequential waterfall
const accounts = await getAccounts(orgId);
const categories = await getCategories(orgId);
```

## Guard Clauses Over Deep Nesting

```typescript
// GOOD — early returns, flat structure
async function deleteTransaction(id: string): Promise<ActionResult<void>> {
  const transaction = await getTransaction(id);
  if (!transaction) return { success: false, error: "Transaction not found" };
  if (transaction.status === "reconciled") {
    return { success: false, error: "Cannot delete reconciled transactions" };
  }

  await supabase.from("transactions").delete().eq("id", id);
  return { success: true, data: undefined };
}
```
