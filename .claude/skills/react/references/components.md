# Components Reference

## Contents
- File Organization
- Server vs Client Components
- Props Patterns
- WARNING: Inline Object Props
- WARNING: Index as Key
- Composition Patterns
- Domain Component Examples

## File Organization

```
components/
├── ui/                  # shadcn/ui primitives (Button, Input, Select, Dialog, etc.)
├── forms/               # Domain forms (transaction-form.tsx, account-form.tsx)
├── tables/              # Data tables (transactions-table.tsx)
└── layout/              # Shell components (header.tsx, sidebar.tsx, org-switcher.tsx)
```

- File names: kebab-case (`transaction-form.tsx`)
- Component names: PascalCase (`TransactionForm`)
- One component per file for domain components; shadcn/ui may co-locate variants

## Server vs Client Components

**Default is Server Component.** Only add `"use client"` when the component uses:
- Hooks (`useState`, `useEffect`, `useContext`, custom hooks)
- Event handlers (`onClick`, `onChange`, `onSubmit`)
- Browser APIs (`window`, `document`, `localStorage`)

```tsx
// Server Component - NO directive needed
// app/(dashboard)/organizations/[orgId]/accounts/page.tsx
import { createClient } from "@/lib/supabase/server";
import { AccountCard } from "@/components/accounts/account-card";

export default async function AccountsPage({ params }: Readonly<{ params: { orgId: string } }>) {
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("organization_id", params.orgId)
    .eq("is_active", true);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {accounts?.map((account) => (
        <AccountCard key={account.id} account={account} />
      ))}
    </div>
  );
}
```

```tsx
// Client Component - needs hooks and events
// components/layout/org-switcher.tsx
"use client";

import { useActiveOrg } from "@/hooks/use-active-org";
import { useOrganizations } from "@/hooks/use-organizations";

export function OrgSwitcher() {
  const { activeOrgId, setActiveOrgId } = useActiveOrg();
  const { data: orgs } = useOrganizations();
  // ... renders select with onChange
}
```

## Props Patterns

Always wrap props with `Readonly<>`. This is the established convention in this codebase (see `app/layout.tsx`).

```tsx
// Simple props
export function StatusBadge({ status }: Readonly<{ status: "uncleared" | "cleared" | "reconciled" }>) {
  const styles = {
    uncleared: "bg-yellow-100 text-yellow-800",
    cleared: "bg-green-100 text-green-800",
    reconciled: "bg-blue-100 text-blue-800",
  } as const;

  return <span className={`rounded px-2 py-1 text-xs font-medium ${styles[status]}`}>{status}</span>;
}
```

```tsx
// Complex props with interface
interface TransactionRowProps {
  transaction: Transaction;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (status: Transaction["status"]) => void;
}

export function TransactionRow(props: Readonly<TransactionRowProps>) {
  // destructure inside body if many props
  const { transaction, isExpanded, onToggleExpand, onStatusChange } = props;
  // ...
}
```

## WARNING: Inline Object Props

**The Problem:**

```tsx
// BAD - New object reference every render, breaks React.memo
<TransactionTable
  filters={{ accountId, status, startDate, endDate }}
  columns={["date", "description", "amount"]}
/>
```

**Why This Breaks:** Even if the values inside haven't changed, a new object is created on every render. Memoized child components re-render unnecessarily, degrading performance in the transaction list view which may display hundreds of rows.

**The Fix:**

```tsx
// GOOD - Stable reference via useMemo
const filters = useMemo(
  () => ({ accountId, status, startDate, endDate }),
  [accountId, status, startDate, endDate]
);

const COLUMNS = ["date", "description", "amount"] as const;

<TransactionTable filters={filters} columns={COLUMNS} />
```

## WARNING: Index as Key

**The Problem:**

```tsx
// BAD - Index key in a dynamic, reorderable list
{lineItems.map((item, index) => (
  <LineItemRow key={index} item={item} onRemove={() => removeItem(index)} />
))}
```

**Why This Breaks:** When a line item is removed from the middle, React associates the wrong state with the wrong row. Form inputs show values from the wrong line item. This is catastrophic for the split transaction form where amounts must sum correctly.

**The Fix:**

```tsx
// GOOD - Use stable unique IDs
{lineItems.map((item) => (
  <LineItemRow key={item.id} item={item} onRemove={() => removeItem(item.id)} />
))}
```

Generate temporary IDs for new items: `crypto.randomUUID()`.

## Composition Patterns

### Slot Pattern for Layout

```tsx
// components/layout/page-header.tsx
interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: Readonly<PageHeaderProps>) {
  return (
    <div className="flex items-center justify-between border-b pb-4">
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        {description && <p className="text-sm text-zinc-500">{description}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
```

### Compound Component for Status

```tsx
// Usage: clear semantic intent
<PageHeader
  title="Transactions"
  description="Manage income and expenses"
  actions={
    <>
      <Button variant="outline" onClick={handleExport}>Export</Button>
      <Button onClick={handleAdd}>Add Transaction</Button>
    </>
  }
/>
```

## Domain Component Examples

### Amount Display

```tsx
// components/ui/amount-display.tsx
interface AmountDisplayProps {
  amount: number;
  type: "income" | "expense";
}

export function AmountDisplay({ amount, type }: Readonly<AmountDisplayProps>) {
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);

  return (
    <span className={type === "income" ? "text-green-600" : "text-red-600"}>
      {type === "expense" ? `-${formatted}` : formatted}
    </span>
  );
}
```

### Category Display

```tsx
// components/ui/category-label.tsx
import type { Category } from "@/types";

interface CategoryLabelProps {
  category: Category;
  parent?: Category;
}

export function CategoryLabel({ category, parent }: Readonly<CategoryLabelProps>) {
  if (parent) {
    return <span>{parent.name} &rarr; {category.name}</span>;
  }
  return <span>{category.name}</span>;
}
```

See the **tailwind** skill for styling conventions. See the **frontend-design** skill for UI/UX patterns.
