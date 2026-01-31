# State Management Reference

## Contents
- State Categories
- UI State with useState
- Client State with Context
- Server State with TanStack Query
- URL State with Search Params
- WARNING: Prop Drilling Past 3 Levels
- WARNING: State for Derived Values

## State Categories

| Category | Tool | Example |
|----------|------|---------|
| **UI State** | `useState` | Modal open/closed, expanded rows, form inputs |
| **Client State** | React Context | Active organization, theme preference |
| **Server State** | TanStack Query | Transactions, accounts, categories from Supabase |
| **URL State** | `searchParams` / `useSearchParams` | Filters, pagination, sort order |

Misidentifying the category leads to over-engineering or bugs. Server state is NOT `useState`.

## UI State with useState

For transient state local to one component.

```tsx
"use client";

import { useState } from "react";

export function TransactionRow({ transaction }: Readonly<{ transaction: Transaction }>) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <>
      <tr onClick={() => setIsExpanded(!isExpanded)}>
        <td>{transaction.description}</td>
        <td>{transaction.amount}</td>
      </tr>
      {isExpanded && (
        <tr>
          <td colSpan={2}>
            {transaction.line_items.map((item) => (
              <div key={item.id}>{item.category_name}: ${item.amount}</div>
            ))}
          </td>
        </tr>
      )}
    </>
  );
}
```

## Client State with Context

For state shared across many components in a subtree. This app uses Context for the active organization selection.

```tsx
// components/layout/active-org-provider.tsx
"use client";

import { createContext, useState, useCallback } from "react";
import type { Organization } from "@/types";

interface ActiveOrgContextType {
  activeOrgId: string | null;
  activeOrg: Organization | null;
  setActiveOrgId: (id: string) => void;
}

export const ActiveOrgContext = createContext<ActiveOrgContextType | null>(null);

export function ActiveOrgProvider({
  children,
  organizations,
}: Readonly<{
  children: React.ReactNode;
  organizations: Organization[];
}>) {
  const [activeOrgId, setActiveOrgId] = useState<string | null>(
    organizations[0]?.id ?? null
  );

  const activeOrg = organizations.find((o) => o.id === activeOrgId) ?? null;

  return (
    <ActiveOrgContext.Provider value={{ activeOrgId, activeOrg, setActiveOrgId }}>
      {children}
    </ActiveOrgContext.Provider>
  );
}
```

```tsx
// hooks/use-active-org.ts
"use client";

import { useContext } from "react";
import { ActiveOrgContext } from "@/components/layout/active-org-provider";

export function useActiveOrg() {
  const context = useContext(ActiveOrgContext);
  if (!context) {
    throw new Error("useActiveOrg must be used within ActiveOrgProvider");
  }
  return context;
}
```

## Server State with TanStack Query

All data from Supabase is server state. See the **tanstack-query** skill for detailed patterns.

```tsx
// DO - Server state via query
const { data: accounts } = useAccounts(orgId);

// DON'T - Server state in useState
const [accounts, setAccounts] = useState<Account[]>([]); // Wrong tool for the job
```

Query keys follow the pattern: `[entity, ...filters]`

```tsx
["organizations"]                          // All orgs
["accounts", orgId]                        // Accounts for an org
["transactions", { orgId, status, accountId }]  // Filtered transactions
["categories", orgId, "expense"]           // Expense categories for an org
```

## URL State with Search Params

Filters, pagination, and sort order belong in the URL for shareability and browser navigation.

```tsx
// components/tables/transaction-filters.tsx
"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";

export function TransactionFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return (
    <div className="flex gap-4">
      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateFilter("status", e.target.value || null)}
      >
        <option value="">All Statuses</option>
        <option value="uncleared">Uncleared</option>
        <option value="cleared">Cleared</option>
        <option value="reconciled">Reconciled</option>
      </select>
    </div>
  );
}
```

## WARNING: Prop Drilling Past 3 Levels

**The Problem:**

```tsx
// BAD - activeOrg threaded through every layer
<DashboardLayout activeOrg={org}>
  <Sidebar activeOrg={org}>
    <NavItem activeOrg={org}>
      <OrgBadge activeOrg={org} />  // 4 levels deep
    </NavItem>
  </Sidebar>
</DashboardLayout>
```

**Why This Breaks:** Every intermediate component must know about `activeOrg` even if it doesn't use it. Renaming the prop requires changes in every file. Adding a new consumer means threading through more layers.

**The Fix:** Use the Context pattern shown above. Components call `useActiveOrg()` directly.

```tsx
// GOOD - OrgBadge gets its own data
function OrgBadge() {
  const { activeOrg } = useActiveOrg();
  return <span>{activeOrg?.name}</span>;
}
```

## WARNING: State for Derived Values

**The Problem:**

```tsx
// BAD - Manual sync between lineItems and total
const [lineItems, setLineItems] = useState<LineItem[]>([initialItem]);
const [total, setTotal] = useState(0);
const [isBalanced, setIsBalanced] = useState(true);

function addLineItem(item: LineItem) {
  setLineItems((prev) => [...prev, item]);
  setTotal((prev) => prev + item.amount);
  setIsBalanced(total + item.amount === transactionAmount); // Bug: stale `total`
}
```

**Why This Breaks:** `total` in the `setIsBalanced` call is the value from the previous render, not the updated value. The balance check shows incorrect results. For a financial app, this is a critical data integrity issue.

**The Fix:**

```tsx
// GOOD - Derive everything from lineItems
const [lineItems, setLineItems] = useState<LineItem[]>([initialItem]);

const total = lineItems.reduce((sum, item) => sum + item.amount, 0);
const isBalanced = total === transactionAmount;
const remaining = transactionAmount - total;
```

**Rule:** If a value can be computed from existing state, compute it. Don't store it.
