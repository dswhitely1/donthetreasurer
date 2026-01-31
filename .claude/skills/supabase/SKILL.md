---
name: supabase
description: |
  Manages Supabase PostgreSQL, authentication, RLS policies, and server/client SDKs.
  Use when: setting up Supabase clients (browser, server, middleware), writing database queries with RLS awareness, implementing auth flows, creating migrations, generating TypeScript types, or configuring Row Level Security policies.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Supabase Skill

Supabase provides PostgreSQL with Row Level Security, JWT-based auth, and TypeScript SDK. This project uses three client entry points: browser client (`lib/supabase/client.ts`), server client (`lib/supabase/server.ts`), and middleware (`middleware.ts`). RLS policies enforce the ownership chain: Treasurer -> Organizations -> Accounts -> Transactions -> Line Items. Always use `getUser()` (not `getSession()`) for auth verification.

## Quick Start

### Browser Client (Client Components)

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

### Server Client (Server Components, Server Actions, API Routes)

```typescript
// lib/supabase/server.ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );
}
```

### Query with RLS

```typescript
const supabase = await createClient();
const { data, error } = await supabase
  .from("transactions")
  .select("*, transaction_line_items(*, categories(*))")
  .eq("account_id", accountId)
  .order("transaction_date", { ascending: false });

if (error) return { success: false, error: error.message };
```

## Key Concepts

| Concept | Pattern |
|---------|---------|
| Three clients | Browser, Server, Middleware — never mix |
| Auth check | `supabase.auth.getUser()` (verified via JWT) |
| RLS | Policies auto-filter data by `auth.uid()` |
| Error handling | Always check `{ data, error }` return |
| Type generation | `npx supabase gen types typescript` |
| Migrations | `supabase/migrations/*.sql` |

## See Also

- [patterns](references/patterns.md) — Client architecture, RLS ownership chain, auth patterns, query patterns
- [workflows](references/workflows.md) — Project setup, migration workflow, type generation, auth flows

## Related Skills

- See the **nextjs** skill for Server Actions and middleware integration
- See the **typescript** skill for generated type usage
- See the **zod** skill for validating data before inserts
- See the **tanstack-query** skill for client-side query caching

## Documentation Resources

> Fetch latest Supabase documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "supabase"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Recommended Queries:**
- "Supabase SSR Next.js App Router setup"
- "Supabase Row Level Security policies"
- "Supabase auth getUser server components"
- "Supabase TypeScript type generation"
