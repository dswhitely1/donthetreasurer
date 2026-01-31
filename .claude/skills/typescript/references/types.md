# TypeScript Types Reference

## Contents
- Generated Database Types
- Domain Type Definitions
- Utility Types for This Project
- WARNING: Duplicating Database Types by Hand
- WARNING: Loose String Types for Domain Values
- Component Prop Types
- Form and Validation Types
- Generic Patterns

## Generated Database Types

All database types come from Supabase CLI generation. NEVER hand-write types that mirror database tables.

```bash
npx supabase gen types typescript --project-id <id> > types/database.ts
```

```typescript
// types/database.ts — auto-generated, do not edit
export type Database = {
  public: {
    Tables: {
      transactions: {
        Row: { id: string; account_id: string; amount: number; /* ... */ };
        Insert: { account_id: string; amount: number; /* ... */ };
        Update: { amount?: number; description?: string; /* ... */ };
      };
      // ... other tables
    };
  };
};
```

Extract table types with helper aliases:

```typescript
// types/index.ts
import type { Database } from "./database";

type Tables = Database["public"]["Tables"];

export type Transaction = Tables["transactions"]["Row"];
export type TransactionInsert = Tables["transactions"]["Insert"];
export type TransactionUpdate = Tables["transactions"]["Update"];

export type Organization = Tables["organizations"]["Row"];
export type Account = Tables["accounts"]["Row"];
export type Category = Tables["categories"]["Row"];
export type LineItem = Tables["transaction_line_items"]["Row"];
```

## Domain Type Definitions

String literal unions for all domain enums. These match the database CHECK constraints exactly.

```typescript
export type TransactionStatus = "uncleared" | "cleared" | "reconciled";
export type TransactionType = "income" | "expense";
export type AccountType = "checking" | "savings" | "paypal" | "cash" | "other";
export type CategoryType = "income" | "expense";
```

### Composite Domain Types

Types that combine database rows with related data:

```typescript
export type TransactionWithLineItems = Transaction & {
  line_items: (LineItem & { category: Category })[];
};

export type CategoryWithParent = Category & {
  parent: Category | null;
};

export type AccountWithBalance = Account & {
  current_balance: number;
};
```

## Utility Types for This Project

### Action Results

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Paginated Response

```typescript
type PaginatedResponse<T> = {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
};
```

### Report Filters

```typescript
type ReportFilters = {
  start_date: string;  // YYYY-MM-DD
  end_date: string;    // YYYY-MM-DD
  account_id?: string;
  category_id?: string;
  status?: TransactionStatus | TransactionStatus[];
};
```

## WARNING: Duplicating Database Types by Hand

**The Problem:**

```typescript
// BAD — hand-written type that drifts from database schema
type Transaction = {
  id: string;
  account_id: string;
  amount: number;
  description: string;
  status: string; // should be union type, already wrong
};
```

**Why This Breaks:**
1. Schema changes (adding columns, changing types) are not reflected
2. No compile-time errors when the database schema changes
3. Silent mismatches between code and database cause runtime bugs

**The Fix:**

Always derive from generated types. See the **supabase** skill for the generation workflow.

```typescript
// GOOD — derived from generated types
import type { Database } from "@/types/database";
type Transaction = Database["public"]["Tables"]["transactions"]["Row"];
```

## WARNING: Loose String Types for Domain Values

**The Problem:**

```typescript
// BAD — accepts any string, no compile-time validation
function setStatus(status: string) {
  // "pending", "active", "banana" all compile fine
}
```

**Why This Breaks:**
1. Typos compile without errors: `setStatus("clered")` — no warning
2. Refactoring misses string comparisons scattered across the codebase
3. No autocomplete for valid values

**The Fix:**

```typescript
// GOOD — string literal union, catches typos at compile time
type TransactionStatus = "uncleared" | "cleared" | "reconciled";

function setStatus(status: TransactionStatus) {
  // Only 3 valid values, autocomplete works, typos caught
}
```

## Component Prop Types

Follow the established `Readonly<>` wrapper pattern. Use interfaces for component props when extending is likely; use inline types for simple one-off components.

```typescript
// Named interface — when the type is reused or extended
interface TransactionTableProps {
  transactions: TransactionWithLineItems[];
  onStatusChange: (id: string, status: TransactionStatus) => Promise<void>;
  isLoading: boolean;
}

export function TransactionTable({
  transactions,
  onStatusChange,
  isLoading,
}: Readonly<TransactionTableProps>) {}
```

```typescript
// Inline type — for simple, one-off components
export function StatusBadge({
  status,
}: Readonly<{
  status: TransactionStatus;
}>) {}
```

## Form and Validation Types

See the **zod** skill for schema definitions. Infer TypeScript types from Zod schemas to keep a single source of truth.

```typescript
import { z } from "zod";

const transactionSchema = z.object({
  transaction_date: z.string().date(),
  account_id: z.string().uuid(),
  transaction_type: z.enum(["income", "expense"]),
  amount: z.number().positive(),
  description: z.string().min(1).max(255),
  check_number: z.string().optional(),
  line_items: z.array(z.object({
    category_id: z.string().uuid(),
    amount: z.number().positive(),
    memo: z.string().optional(),
  })).min(1),
});

// Infer the type — NEVER duplicate this by hand
type TransactionFormData = z.infer<typeof transactionSchema>;
```

See the **react-hook-form** skill for integrating these types with forms.

## Generic Patterns

### Typed Supabase Queries

```typescript
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";

async function getByOrg<T extends keyof Database["public"]["Tables"]>(
  table: T,
  orgId: string
): Promise<Database["public"]["Tables"][T]["Row"][]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("organization_id", orgId);

  if (error) throw error;
  return data;
}
```

### Branded Types for UUIDs

Prevent accidentally passing an organization ID where an account ID is expected:

```typescript
type Brand<T, B> = T & { __brand: B };

type OrganizationId = Brand<string, "OrganizationId">;
type AccountId = Brand<string, "AccountId">;
type TransactionId = Brand<string, "TransactionId">;

// Compile error: cannot pass OrganizationId where AccountId expected
function getAccount(id: AccountId) { /* ... */ }
```

Use branded types selectively — they add overhead. Best applied at API boundaries where mixing IDs causes real bugs.
