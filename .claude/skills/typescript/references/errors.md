# TypeScript Errors Reference

## Contents
- Error Handling Strategy
- Typed Error Results
- Supabase Error Handling
- Common Compiler Errors and Fixes
- WARNING: Silent Catch Blocks
- WARNING: Throwing Raw Strings
- Validation Errors at Boundaries
- Error Propagation in Server Actions

## Error Handling Strategy

This application has two error boundaries:

1. **System boundaries** (user input, Supabase responses) — validate and handle explicitly
2. **Internal code** — trust types, let unexpected errors propagate to Next.js error boundaries

NEVER add try/catch around internal function calls that have typed return values. Only catch at system boundaries.

## Typed Error Results

Use the `ActionResult` discriminated union for all Server Action returns. This forces callers to handle both success and failure.

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };

// Server Action
export async function createOrganization(
  formData: FormData
): Promise<ActionResult<Organization>> {
  const parsed = organizationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("organizations")
    .insert(parsed.data)
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
```

```typescript
// Client consumption — forced to handle both branches
const result = await createOrganization(formData);
if (!result.success) {
  setError(result.error);
  return;
}
// result.data is typed as Organization here
router.push(`/organizations/${result.data.id}`);
```

## Supabase Error Handling

Supabase client methods return `{ data, error }`. NEVER ignore the error field.

```typescript
// GOOD — check error before using data
const { data, error } = await supabase
  .from("transactions")
  .select("*, transaction_line_items(*, categories(*))")
  .eq("account_id", accountId)
  .order("transaction_date", { ascending: false });

if (error) {
  return { success: false, error: error.message };
}
// data is non-null here due to Supabase's return type narrowing
```

```typescript
// BAD — ignoring error, data may be null
const { data } = await supabase.from("transactions").select("*");
data.forEach(/* ... */); // TypeError if query failed
```

## Common Compiler Errors and Fixes

### TS2322: Type 'X' is not assignable to type 'Y'

Most common error. Usually means a Supabase return type doesn't match expected shape.

```typescript
// Error: Type 'string' is not assignable to type 'TransactionStatus'
const status: TransactionStatus = someTransaction.status;
// Fix: the generated type may be `string`, not the literal union
const status = someTransaction.status as TransactionStatus;
// Better fix: ensure generated types use the correct enum
```

### TS2345: Argument of type 'X' is not assignable to parameter of type 'Y'

```typescript
// Error: formData has extra/missing fields vs schema
const result = transactionSchema.parse(formData);
// Fix: check which fields the schema expects vs what you're passing
```

### TS7006: Parameter 'x' implicitly has an 'any' type

Strict mode catches untyped parameters. Always annotate.

```typescript
// BAD — implicit any
const handleClick = (e) => { /* ... */ };

// GOOD — explicit type
const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => { /* ... */ };
```

### TS2532: Object is possibly 'undefined'

```typescript
// Error: account.transactions may be undefined
const total = account.transactions.reduce((s, t) => s + t.amount, 0);

// Fix: nullish coalescing
const total = (account.transactions ?? []).reduce((s, t) => s + t.amount, 0);
```

### TS18046: 'X' is of type 'unknown'

Occurs when catching errors or working with `JSON.parse`.

```typescript
// Error: caught error is unknown
try { /* ... */ } catch (e) {
  console.log(e.message); // TS error: e is unknown
}

// Fix: narrow the type
try { /* ... */ } catch (e) {
  const message = e instanceof Error ? e.message : "Unknown error";
  console.log(message);
}
```

## WARNING: Silent Catch Blocks

**The Problem:**

```typescript
// BAD — error swallowed, user sees nothing, data is silently wrong
try {
  await supabase.from("transactions").insert(data);
} catch {
  // nothing here
}
```

**Why This Breaks:**
1. Failed inserts appear successful — user thinks data was saved
2. Financial data integrity compromised — this is a bookkeeping app
3. No logging means no debugging capability in production

**The Fix:**

```typescript
// GOOD — handle and surface the error
const { error } = await supabase.from("transactions").insert(data);
if (error) {
  return { success: false, error: error.message };
}
```

Note: Supabase client does not throw — it returns `{ data, error }`. Use the return-based pattern, not try/catch, for Supabase operations.

## WARNING: Throwing Raw Strings

**The Problem:**

```typescript
// BAD — throws a string, not an Error
throw "Transaction not found";
```

**Why This Breaks:**
1. `catch (e) { e.message }` returns `undefined` — string has no `.message`
2. No stack trace — impossible to debug in production
3. `instanceof Error` checks fail

**The Fix:**

```typescript
// GOOD — throw Error objects
throw new Error("Transaction not found");

// BETTER — custom error class for domain errors
class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} not found: ${id}`);
    this.name = "NotFoundError";
  }
}

throw new NotFoundError("Transaction", transactionId);
```

## Validation Errors at Boundaries

Validate ALL external input at system boundaries using Zod. See the **zod** skill for schema patterns.

```typescript
// Server Action — validate form input
export async function createTransaction(
  formData: FormData
): Promise<ActionResult<Transaction>> {
  const raw = Object.fromEntries(formData);
  const parsed = transactionSchema.safeParse(raw);

  if (!parsed.success) {
    // Return first validation error to user
    return {
      success: false,
      error: parsed.error.issues[0].message,
    };
  }

  // parsed.data is fully typed and validated
  // ...proceed with Supabase insert
}
```

```typescript
// API Route — validate query params
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = reportFiltersSchema.safeParse(
    Object.fromEntries(searchParams)
  );

  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues },
      { status: 400 }
    );
  }
  // ...generate report
}
```

## Error Propagation in Server Actions

Iterate-until-pass workflow for fixing type errors:

1. Make changes to types or code
2. Validate: `npm run build`
3. If build fails, read the error output and fix the reported issues
4. Repeat step 2 until build passes
5. Run `npm run lint` for additional checks
6. Only proceed when both pass
