---
name: react
description: |
  Manages React components, hooks, and client-side state with strict mode TypeScript.
  Use when: building components with Server/Client split, creating custom hooks for domain data, managing form state with react-hook-form, implementing state management patterns, or optimizing rendering performance.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# React Skill

React 19 with Server Components as the default. Client Components require `"use client"` directive. All component props wrap with `Readonly<>`. Custom hooks live in `hooks/` with kebab-case `use-` prefix. Server state uses TanStack Query; UI state uses `useState`; shared UI state uses React Context.

## Quick Start

### Server Component (default)

```tsx
// No "use client" — fetches data directly
import { createClient } from "@/lib/supabase/server";

export default async function AccountsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: accounts } = await supabase.from("accounts").select("*").eq("organization_id", orgId);
  return <AccountList accounts={accounts ?? []} />;
}
```

### Client Component

```tsx
"use client";

import { useState } from "react";
import type { Transaction } from "@/types";

export function TransactionRow({ transaction }: Readonly<{ transaction: Transaction }>) {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <tr onClick={() => setIsExpanded(!isExpanded)}>
      <td>{transaction.description}</td>
    </tr>
  );
}
```

### Custom Domain Hook

```tsx
// hooks/use-organizations.ts
"use client";

import { useQuery } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import type { Organization } from "@/types";

export function useOrganizations() {
  const supabase = createClient();
  return useQuery({
    queryKey: ["organizations"],
    queryFn: async (): Promise<Organization[]> => {
      const { data, error } = await supabase.from("organizations").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data;
    },
  });
}
```

## Key Concepts

| Concept | Pattern |
|---------|---------|
| Props convention | `Readonly<>` wrapper on all component props |
| `"use client"` | Only for hooks, event handlers, browser APIs |
| Custom hooks | `hooks/use-*.ts`, wrap TanStack Query |
| Derived state | Compute from existing state, never `useState` for derived values |
| Context | `useActiveOrg()` for active organization |

## See Also

- [hooks](references/hooks.md) — Custom hook patterns, domain hooks, anti-patterns
- [components](references/components.md) — File organization, props patterns, composition
- [data-fetching](references/data-fetching.md) — Server vs Client fetching strategy
- [state](references/state.md) — UI, Client, Server, URL state categories
- [forms](references/forms.md) — React Hook Form integration, transaction form
- [performance](references/performance.md) — Memoization, code splitting, bundle size

## Related Skills

- See the **nextjs** skill for App Router and Server Component patterns
- See the **tanstack-query** skill for server state management
- See the **react-hook-form** skill for form handling
- See the **typescript** skill for strict type safety
- See the **zod** skill for validation schemas
- See the **tailwind** skill for component styling
- See the **frontend-design** skill for UI/UX patterns

## Documentation Resources

> Fetch latest React documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "react"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Library ID:** `/websites/react_dev`

**Recommended Queries:**
- "React Server Components vs Client Components"
- "React useCallback useMemo optimization"
- "React Context Provider pattern"
- "React useFieldArray dynamic form fields"
