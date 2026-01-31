---
name: tanstack-query
description: |
  Handles server state management, caching, and data synchronization with TanStack Query.
  Use when: creating query hooks for domain data, implementing mutations with cache invalidation, setting up QueryClientProvider, prefetching data on the server, or debugging stale data issues.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# TanStack Query Skill

TanStack Query v5 manages server state in Client Components. QueryClient is created per-request using the `isServer` pattern. Custom hooks in `hooks/` wrap `useQuery` and `useMutation` with Supabase client calls. Query keys follow `[entity, ...filters]` convention matching the Treasurer entity hierarchy.

## Quick Start

### QueryClient Provider

```tsx
// components/providers/query-provider.tsx
"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export function QueryProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 60 * 1000, retry: 1 },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
```

### Domain Query Hook

```tsx
// hooks/use-transactions.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Transaction } from "@/types";

export function useTransactions(filters: { orgId: string; status?: string }) {
  const supabase = createClient();
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: async (): Promise<Transaction[]> => {
      let query = supabase.from("transactions").select("*, transaction_line_items(*, categories(*))");
      if (filters.status) query = query.eq("status", filters.status);
      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: Boolean(filters.orgId),
  });
}
```

### Mutation with Cache Invalidation

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useUpdateTransactionStatus() {
  const queryClient = useQueryClient();
  const supabase = createClient();

  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { data, error } = await supabase.from("transactions").update({ status }).eq("id", id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
```

## Key Concepts

| Concept | Pattern |
|---------|---------|
| Query keys | `[entity, ...filters]` — e.g., `["transactions", { orgId, status }]` |
| `enabled` | Conditional fetching — prevents queries with undefined params |
| Invalidation | `invalidateQueries` after mutations, cascade to related entities |
| `staleTime` | 60s default — prevents redundant refetches |
| Error handling | `throw error` in queryFn — caught by error boundaries |

## See Also

- [patterns](references/patterns.md) — Query key factory, SSR prefetching, optimistic updates, anti-patterns
- [workflows](references/workflows.md) — Installation, adding hooks, mutation integration, SSR prefetch

## Related Skills

- See the **supabase** skill for client configuration and queries
- See the **react** skill for hook patterns and data-fetching strategy
- See the **nextjs** skill for SSR prefetch with HydrationBoundary
- See the **typescript** skill for typed query results
- See the **react-hook-form** skill for mutation + form integration
- See the **zod** skill for validating mutation inputs

## Documentation Resources

> Fetch latest TanStack Query documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "tanstack query"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/tanstack_query_v5`

**Recommended Queries:**
- "TanStack Query useQuery queryKey conventions"
- "TanStack Query useMutation cache invalidation"
- "TanStack Query SSR Next.js App Router hydration"
- "TanStack Query optimistic updates"
