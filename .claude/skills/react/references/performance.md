# Performance Reference

## Contents
- Memoization Patterns
- WARNING: Inline Object/Array Props
- Preventing Unnecessary Re-renders
- Code Splitting and Lazy Loading
- Bundle Size
- Expensive Computations

## Memoization Patterns

### When to Use Each

| Tool | When | NOT When |
|------|------|----------|
| `React.memo` | Component receives same props often but parent re-renders | Props change on nearly every render |
| `useMemo` | Expensive computation or stabilizing object references | Simple calculations or primitives |
| `useCallback` | Passing callback to memoized child or dependency array | Inline handler on a native element |

### React.memo for Table Rows

Transaction tables can have hundreds of rows. Memoize row components.

```tsx
// components/tables/transaction-row.tsx
"use client";

import { memo } from "react";
import type { Transaction } from "@/types";

interface TransactionRowProps {
  transaction: Transaction;
  onStatusChange: (id: string, status: string) => void;
}

export const TransactionRow = memo(function TransactionRow({
  transaction,
  onStatusChange,
}: Readonly<TransactionRowProps>) {
  return (
    <tr>
      <td>{transaction.transaction_date}</td>
      <td>{transaction.description}</td>
      <td>{transaction.amount}</td>
      <td>
        <button onClick={() => onStatusChange(transaction.id, "cleared")}>
          Mark Cleared
        </button>
      </td>
    </tr>
  );
});
```

### useCallback for Stable Handlers

When passing handlers to memoized children, stabilize with `useCallback`.

```tsx
"use client";

import { useCallback } from "react";
import { useUpdateTransactionStatus } from "@/hooks/use-update-transaction-status";
import { TransactionRow } from "./transaction-row";

export function TransactionTable({ transactions }: Readonly<{ transactions: Transaction[] }>) {
  const { mutate: updateStatus } = useUpdateTransactionStatus();

  const handleStatusChange = useCallback(
    (id: string, status: string) => updateStatus({ id, status }),
    [updateStatus]
  );

  return (
    <table>
      <tbody>
        {transactions.map((txn) => (
          <TransactionRow
            key={txn.id}
            transaction={txn}
            onStatusChange={handleStatusChange}
          />
        ))}
      </tbody>
    </table>
  );
}
```

## WARNING: Inline Object/Array Props

**The Problem:**

```tsx
// BAD - New reference every render
<CategorySelect
  options={categories.map((c) => ({ label: c.name, value: c.id }))}
  style={{ width: 200 }}
/>
```

**Why This Breaks:** `options` is a new array every render. If `CategorySelect` uses `React.memo` or has internal `useEffect` depending on `options`, it re-runs every time the parent renders. In a transaction form with many fields, this causes sluggish typing.

**The Fix:**

```tsx
// GOOD - Stable references
const categoryOptions = useMemo(
  () => categories.map((c) => ({ label: c.name, value: c.id })),
  [categories]
);

const SELECT_STYLE = { width: 200 } as const;

<CategorySelect options={categoryOptions} style={SELECT_STYLE} />
```

## Preventing Unnecessary Re-renders

### Split Client Components

Isolate interactive parts into smaller client components. Keep the parent as a Server Component.

```tsx
// BAD - Entire page becomes client component because of one interactive piece
"use client";
export default function TransactionsPage() {
  const [filter, setFilter] = useState("");
  return (
    <div>
      <h1>Transactions</h1>           {/* Static - doesn't need client */}
      <p>Description paragraph</p>     {/* Static */}
      <FilterBar onChange={setFilter} /> {/* Interactive */}
      <TransactionList filter={filter} /> {/* Interactive */}
    </div>
  );
}
```

```tsx
// GOOD - Server Component page with targeted client islands
// app/(dashboard)/organizations/[orgId]/transactions/page.tsx (Server Component)
import { TransactionView } from "@/components/tables/transaction-view";

export default async function TransactionsPage({ params }: Readonly<{ params: { orgId: string } }>) {
  return (
    <div>
      <h1>Transactions</h1>
      <p>Description paragraph</p>
      <TransactionView orgId={params.orgId} />  {/* Only this is "use client" */}
    </div>
  );
}
```

### Avoid Re-renders from Context

When Context value changes, all consumers re-render. Split context by update frequency.

```tsx
// BAD - Single context that changes often
const AppContext = createContext({ activeOrg, theme, sidebarOpen, notifications });

// GOOD - Separate contexts by update frequency
const OrgContext = createContext({ activeOrg });     // Changes rarely
const UIContext = createContext({ sidebarOpen });      // Changes often
```

## Code Splitting and Lazy Loading

### Dynamic Import for Heavy Components

```tsx
// GOOD - Excel export dialog loaded only when needed
"use client";

import { lazy, Suspense, useState } from "react";

const ExportDialog = lazy(() => import("@/components/reports/export-dialog"));

export function ReportActions() {
  const [showExport, setShowExport] = useState(false);

  return (
    <>
      <button onClick={() => setShowExport(true)}>Export to Excel</button>
      {showExport && (
        <Suspense fallback={<div>Loading export...</div>}>
          <ExportDialog onClose={() => setShowExport(false)} />
        </Suspense>
      )}
    </>
  );
}
```

### Next.js Dynamic Import

See the **nextjs** skill for `next/dynamic` patterns.

```tsx
import dynamic from "next/dynamic";

const TransactionsChart = dynamic(
  () => import("@/components/charts/transactions-chart"),
  { loading: () => <div className="h-64 animate-pulse bg-zinc-100" /> }
);
```

## Bundle Size

### Audit Dependencies Before Adding

```bash
# Check bundle impact of a package before installing
npx bundlephobia-cli exceljs
```

### Import Patterns

```tsx
// BAD - Imports entire library
import * as dateFns from "date-fns";

// GOOD - Tree-shakeable named import
import { format, parseISO } from "date-fns";
```

```tsx
// BAD - Imports all icons
import * as Icons from "lucide-react";

// GOOD - Only the icons you need
import { ChevronDown, Lock, Check } from "lucide-react";
```

## Expensive Computations

### Category Hierarchy Computation

Building the parent-child category tree from a flat list is O(n) but can be memoized when categories don't change between renders.

```tsx
"use client";

import { useMemo } from "react";
import type { Category } from "@/types";

interface CategoryTree {
  parent: Category;
  children: Category[];
}

export function useCategoryTree(categories: Category[]): CategoryTree[] {
  return useMemo(() => {
    const parents = categories.filter((c) => !c.parent_id);
    return parents.map((parent) => ({
      parent,
      children: categories.filter((c) => c.parent_id === parent.id),
    }));
  }, [categories]);
}
```

### Running Balance Computation

Transaction list with running balance is O(n). Only recompute when the transaction list changes.

```tsx
const transactionsWithBalance = useMemo(() => {
  let balance = openingBalance;
  return transactions.map((txn) => {
    balance += txn.transaction_type === "income" ? txn.amount : -txn.amount;
    return { ...txn, runningBalance: balance };
  });
}, [transactions, openingBalance]);
```

Do NOT use `useMemo` for trivial computations like `lineItems.length > 1` or string formatting. The overhead of memoization exceeds the cost of recomputation.
