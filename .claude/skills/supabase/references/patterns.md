# Supabase Patterns Reference

## Contents
- Client Architecture
- Row Level Security Patterns
- Auth Patterns
- Type Safety
- Query Patterns
- Anti-Patterns

---

## Client Architecture

This project requires **three** Supabase entry points: browser client, server client, and middleware.

### Browser Client — Client Components Only

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

Singleton per tab. Call `createClient()` directly in components or hooks—`@supabase/ssr` deduplicates internally.

### Server Client — Server Components, Server Actions, Route Handlers

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Ignored in Server Components; middleware handles token refresh.
          }
        },
      },
    }
  )
}
```

**NEVER cache or share** the server client across requests. Create a new one per request.

### Middleware — Session Refresh

```typescript
// lib/supabase/middleware.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  await supabase.auth.getUser()
  return supabaseResponse
}
```

The `getUser()` call refreshes the session token if expired. Without this, server-side auth silently fails after token expiry.

---

## Row Level Security Patterns

### Ownership Chain

This project's RLS uses a join-based ownership chain. Every table traces back to `auth.uid()`:

```sql
-- Direct ownership (organizations)
CREATE POLICY "own_orgs" ON organizations
  FOR ALL USING (treasurer_id = auth.uid());

-- One hop (accounts -> organizations)
CREATE POLICY "own_accounts" ON accounts
  FOR ALL USING (
    organization_id IN (
      SELECT id FROM organizations WHERE treasurer_id = auth.uid()
    )
  );

-- Two hops (transactions -> accounts -> organizations)
CREATE POLICY "own_transactions" ON transactions
  FOR ALL USING (
    account_id IN (
      SELECT a.id FROM accounts a
      JOIN organizations o ON a.organization_id = o.id
      WHERE o.treasurer_id = auth.uid()
    )
  );
```

### WARNING: `FOR ALL` vs Separate Policies

Using `FOR ALL` creates a single policy covering SELECT, INSERT, UPDATE, DELETE. This is fine when the condition is identical for all operations. If INSERT needs `WITH CHECK` logic different from SELECT's `USING`, split into separate policies per operation.

### WARNING: Forgetting to Enable RLS

```sql
-- BAD - Table is world-readable without RLS
CREATE TABLE public.organizations (...);

-- GOOD - Always enable RLS immediately after creating the table
CREATE TABLE public.organizations (...);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
```

**Why this breaks:** Without RLS enabled, the anon key grants full read/write access to the table. This is a data breach waiting to happen.

---

## Auth Patterns

### Getting the Authenticated User

```typescript
// GOOD - getUser() validates the JWT server-side
const { data: { user }, error } = await supabase.auth.getUser()

// BAD - getSession() trusts the JWT without validation
const { data: { session } } = await supabase.auth.getSession()
```

`getUser()` makes a network call to Supabase to verify the token. `getSession()` only reads the local JWT, which could be tampered with. **Always use `getUser()` for authorization checks.**

### Protecting Server Actions

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'

export async function createOrganization(formData: FormData) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('organizations')
    .insert({ treasurer_id: user.id, name: formData.get('name') as string })
    .select()
    .single()

  if (error) throw new Error(error.message)
  return data
}
```

---

## Type Safety

### Generated Types from Supabase CLI

```bash
npx supabase gen types typescript --local > types/database.ts
```

Then use in the client:

```typescript
import type { Database } from '@/types/database'

// Server client with types
export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* ... */ } }
  )
}
```

See the **typescript** skill for strict mode patterns and type organization.

---

## Query Patterns

### Selecting Related Data

```typescript
// Fetch transactions with their line items and category details
const { data } = await supabase
  .from('transactions')
  .select(`
    *,
    transaction_line_items (
      id, amount, memo,
      categories ( id, name, parent_id, category_type )
    )
  `)
  .eq('account_id', accountId)
  .order('transaction_date', { ascending: false })
```

### WARNING: N+1 Queries

**The Problem:**

```typescript
// BAD - One query per transaction to fetch line items
const { data: transactions } = await supabase.from('transactions').select('*')
for (const txn of transactions) {
  const { data: items } = await supabase
    .from('transaction_line_items')
    .select('*')
    .eq('transaction_id', txn.id)
}
```

**Why This Breaks:** 100 transactions = 101 database round-trips. Supabase PostgREST supports nested selects that compile to a single SQL query with joins.

**The Fix:**

```typescript
// GOOD - Single query with embedded relation
const { data } = await supabase
  .from('transactions')
  .select('*, transaction_line_items(*)')
  .eq('account_id', accountId)
```

---

## Anti-Patterns

### WARNING: Using Service Role Key Client-Side

**The Problem:** Exposing `SUPABASE_SERVICE_ROLE_KEY` in a `NEXT_PUBLIC_` variable or in any client bundle.

**Why This Breaks:** The service role key bypasses all RLS policies. Anyone with browser DevTools can extract it and read/write all data in every table.

**The Fix:** Only use the service role key in server-side code (`route.ts`, Server Actions) and store it as `SUPABASE_SERVICE_ROLE_KEY` (no `NEXT_PUBLIC_` prefix).

### WARNING: Skipping Middleware

Without middleware calling `supabase.auth.getUser()`, expired tokens are never refreshed. Server Components will see `user: null` even for logged-in users after the JWT expires (default: 1 hour). The middleware pattern in this file's "Client Architecture" section is mandatory.
