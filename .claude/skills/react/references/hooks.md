# Hooks Reference

## Contents
- Custom Hook Patterns
- Hook Rules in This Codebase
- WARNING: useEffect for Data Fetching
- WARNING: Missing Dependency Array Items
- WARNING: State for Derived Values
- Domain Hook Examples

## Custom Hook Patterns

Custom hooks live in `hooks/` with kebab-case `use-` prefix files. They wrap TanStack Query for server state. See the **tanstack-query** skill for query configuration.

### Domain Data Hook

```tsx
// hooks/use-organizations.ts
"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Organization } from "@/types";

export function useOrganizations() {
  const supabase = createClient();

  return useQuery({
    queryKey: ["organizations"],
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await supabase
        .from("organizations")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateOrganization() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async (org: { name: string; ein?: string }) => {
      const { data, error } = await supabase
        .from("organizations")
        .insert(org)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organizations"] });
    },
  });
}
```

### Filtered Data Hook

```tsx
// hooks/use-transactions.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/types";

interface TransactionFilters {
  orgId: string;
  accountId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export function useTransactions(filters: TransactionFilters) {
  const supabase = createClient();

  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: async (): Promise<Transaction[]> => {
      let query = supabase
        .from("transactions")
        .select("*, transaction_line_items(*, categories(*))")
        .order("transaction_date", { ascending: false });

      if (filters.accountId) query = query.eq("account_id", filters.accountId);
      if (filters.status) query = query.eq("status", filters.status);
      if (filters.startDate) query = query.gte("transaction_date", filters.startDate);
      if (filters.endDate) query = query.lte("transaction_date", filters.endDate);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: Boolean(filters.orgId),
  });
}
```

## Hook Rules in This Codebase

| Rule | Reason |
|------|--------|
| Hooks only in `"use client"` files | Server Components cannot use hooks |
| One query key pattern per entity | Prevents cache fragmentation |
| Always pass `enabled` for conditional fetches | Prevents fetches with undefined params |
| Return the full query result | Let consumers handle loading/error states |

## WARNING: useEffect for Data Fetching

**The Problem:**

```tsx
// BAD - Race conditions, no caching, no error boundaries
"use client";
import { useState, useEffect } from "react";

function TransactionList({ orgId }: { orgId: string }) {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    fetch(`/api/organizations/${orgId}/transactions`)
      .then((r) => r.json())
      .then(setTransactions);
  }, [orgId]);

  return <div>{/* render */}</div>;
}
```

**Why This Breaks:**
1. Fast org switching causes stale data from the previous org to overwrite current data
2. No loading or error states without additional boilerplate
3. Every mount triggers a new request with zero caching
4. Component unmount before fetch completes causes setState on unmounted component

**The Fix:**

```tsx
// GOOD - Use TanStack Query via custom hook
"use client";
import { useTransactions } from "@/hooks/use-transactions";

function TransactionList({ orgId }: Readonly<{ orgId: string }>) {
  const { data: transactions, isLoading, error } = useTransactions({ orgId });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error loading transactions</div>;

  return <div>{/* render */}</div>;
}
```

Or prefer Server Components for initial data loads. See the **nextjs** skill.

## WARNING: Missing Dependency Array Items

**The Problem:**

```tsx
// BAD - orgId changes won't trigger recalculation
const filteredTransactions = useMemo(
  () => transactions.filter((t) => t.account_id === accountId),
  [transactions] // Missing accountId!
);
```

**Why This Breaks:** `filteredTransactions` shows stale results when the user switches accounts because the memo closure captured an old `accountId`.

**The Fix:**

```tsx
// GOOD - All referenced values in deps
const filteredTransactions = useMemo(
  () => transactions.filter((t) => t.account_id === accountId),
  [transactions, accountId]
);
```

Enable the `react-hooks/exhaustive-deps` ESLint rule (included via `eslint-config-next`).

## WARNING: State for Derived Values

**The Problem:**

```tsx
// BAD - Synchronization bug waiting to happen
const [lineItems, setLineItems] = useState<LineItem[]>([]);
const [lineItemsTotal, setLineItemsTotal] = useState(0);

// Must remember to call setLineItemsTotal every time lineItems changes
```

**Why This Breaks:** The total gets out of sync with line items when any update path forgets to recalculate. This is critical in the Treasurer app where line item totals must match the transaction amount.

**The Fix:**

```tsx
// GOOD - Derive during render
const [lineItems, setLineItems] = useState<LineItem[]>([]);
const lineItemsTotal = lineItems.reduce((sum, item) => sum + item.amount, 0);
```

No `useMemo` needed unless profiling shows the computation is expensive (it won't be for < 100 line items).

## Domain Hook Examples

### Active Organization Context Hook

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

### Category Hierarchy Hook

```tsx
// hooks/use-categories.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/types";

export function useCategories(orgId: string, type?: "income" | "expense") {
  const supabase = createClient();

  return useQuery({
    queryKey: ["categories", orgId, type],
    queryFn: async (): Promise<Category[]> => {
      let query = supabase
        .from("categories")
        .select("*")
        .eq("organization_id", orgId)
        .eq("is_active", true)
        .order("name");

      if (type) query = query.eq("category_type", type);

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: Boolean(orgId),
  });
}
```
