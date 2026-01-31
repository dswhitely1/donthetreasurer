# Data Fetching Reference

## Contents
- Strategy Overview
- Server Component Fetching
- Client-Side Fetching with TanStack Query
- WARNING: Missing Professional Data Fetching Library
- WARNING: useEffect for Data Fetching
- Loading and Error States
- Mutation Patterns

## Strategy Overview

| Context | Method | When |
|---------|--------|------|
| Server Component | Supabase server client with `await` | Initial page loads, SEO content |
| Client Component | TanStack Query via custom hooks | Interactive filtering, real-time updates, mutations |
| API Route | Supabase server client in `route.ts` | Non-HTML responses (Excel export) |
| Server Action | Supabase server client in `"use server"` | Form submissions, data mutations |

See the **nextjs** skill for Server Actions and API Route patterns. See the **supabase** skill for client configuration.

## Server Component Fetching

Server Components fetch data directly with `await`. No loading spinners needed at this level; use `loading.tsx` for Suspense boundaries.

```tsx
// app/(dashboard)/organizations/[orgId]/transactions/page.tsx
import { createClient } from "@/lib/supabase/server";
import { TransactionsTable } from "@/components/tables/transactions-table";

export default async function TransactionsPage({
  params,
  searchParams,
}: Readonly<{
  params: { orgId: string };
  searchParams: { account_id?: string; status?: string };
}>) {
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select("*, transaction_line_items(*, categories(*))")
    .order("transaction_date", { ascending: false });

  if (searchParams.account_id) {
    query = query.eq("account_id", searchParams.account_id);
  }
  if (searchParams.status) {
    query = query.eq("status", searchParams.status);
  }

  const { data: transactions, error } = await query;

  if (error) throw error; // Caught by error.tsx boundary

  return <TransactionsTable initialData={transactions ?? []} orgId={params.orgId} />;
}
```

```tsx
// app/(dashboard)/organizations/[orgId]/transactions/loading.tsx
export default function TransactionsLoading() {
  return <div className="animate-pulse">Loading transactions...</div>;
}
```

## Client-Side Fetching with TanStack Query

For interactive features (filtering, sorting, pagination) where the user changes parameters without full page navigation. See the **tanstack-query** skill for full configuration.

```tsx
// components/tables/transactions-table.tsx
"use client";

import { useState } from "react";
import { useTransactions } from "@/hooks/use-transactions";
import type { Transaction } from "@/types";

interface TransactionsTableProps {
  initialData: Transaction[];
  orgId: string;
}

export function TransactionsTable({ initialData, orgId }: Readonly<TransactionsTableProps>) {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { data: transactions, isLoading } = useTransactions({
    orgId,
    status: statusFilter,
  });

  const displayData = transactions ?? initialData;

  return (
    <div>
      <select
        value={statusFilter ?? ""}
        onChange={(e) => setStatusFilter(e.target.value || undefined)}
      >
        <option value="">All</option>
        <option value="uncleared">Uncleared</option>
        <option value="cleared">Cleared</option>
        <option value="reconciled">Reconciled</option>
      </select>

      {isLoading && <div>Updating...</div>}

      <table>
        <tbody>
          {displayData.map((txn) => (
            <tr key={txn.id}>{/* render transaction row */}</tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

## WARNING: Missing Professional Data Fetching Library

**Detected:** `@tanstack/react-query` is not in `package.json`

**Impact:** Without a data fetching library, developers will default to `useEffect` + `useState`, introducing race conditions, no caching, and poor UX.

### Install TanStack Query

```bash
npm install @tanstack/react-query
```

### Setup Provider

```tsx
// components/providers/query-provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60 * 1000,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

Add to the dashboard layout:

```tsx
// app/(dashboard)/layout.tsx
import { QueryProvider } from "@/components/providers/query-provider";

export default function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <QueryProvider>{children}</QueryProvider>;
}
```

## WARNING: useEffect for Data Fetching

**NEVER do this:**

```tsx
// BAD - Every problem in one snippet
useEffect(() => {
  setLoading(true);
  fetch(`/api/organizations/${orgId}/transactions`)
    .then((r) => r.json())
    .then((data) => {
      setTransactions(data);
      setLoading(false);
    })
    .catch((err) => {
      setError(err);
      setLoading(false);
    });
}, [orgId]);
```

**Consequences in this app:** When a treasurer switches organizations rapidly, transactions from Org A appear under Org B. The treasurer makes a categorization decision based on wrong data. Financial reports are generated from incorrect state.

**The Fix:** Use TanStack Query hooks or Server Components. Both handle cancellation, caching, and race conditions automatically.

## Loading and Error States

### Suspense Boundaries (Server)

```tsx
// app/(dashboard)/organizations/[orgId]/error.tsx
"use client";

export default function TransactionError({ error, reset }: Readonly<{
  error: Error;
  reset: () => void;
}>) {
  return (
    <div className="rounded border border-red-200 bg-red-50 p-4">
      <h2 className="font-semibold text-red-800">Failed to load data</h2>
      <p className="text-sm text-red-600">{error.message}</p>
      <button onClick={reset} className="mt-2 text-sm underline">Try again</button>
    </div>
  );
}
```

### Query States (Client)

```tsx
const { data, isLoading, error, isFetching } = useTransactions({ orgId });

// isLoading: first load (no cached data)
// isFetching: any fetch (including background refetch)

if (isLoading) return <Skeleton />;
if (error) return <ErrorDisplay error={error} />;
```

## Mutation Patterns

Use TanStack Query mutations with optimistic updates for responsive UI. See the **tanstack-query** skill for advanced patterns.

```tsx
// hooks/use-update-transaction-status.ts
"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

export function useUpdateTransactionStatus() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const updates: Record<string, unknown> = { status };
      if (status === "cleared" || status === "reconciled") {
        updates.cleared_at = new Date().toISOString();
      }
      if (status === "uncleared") {
        updates.cleared_at = null;
      }

      const { data, error } = await supabase
        .from("transactions")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
    },
  });
}
```
