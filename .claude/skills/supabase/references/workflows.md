# Supabase Workflows Reference

## Contents
- Project Setup
- Migration Workflow
- Type Generation
- Auth Flow Implementation
- Server Action CRUD Pattern
- Deployment Checklist

---

## Project Setup

### Install Dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install -D supabase
```

### Initialize Supabase Locally

```bash
npx supabase init
npx supabase start
```

This creates `supabase/config.toml` and starts local Postgres, Auth, and Storage containers.

### Environment Variables

Create `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon-key-from-supabase-start-output>
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key>
```

NEVER commit `.env.local`. Verify it's in `.gitignore`.

---

## Migration Workflow

### Creating a Migration

```bash
npx supabase migration new <descriptive_name>
# Creates: supabase/migrations/<timestamp>_<descriptive_name>.sql
```

Write the SQL in the generated file. This project's schema lives in PRD Section 11. The first migration should contain the full schema: tables, indexes, RLS policies, triggers, and functions.

### Applying Migrations

```bash
# Local development
npx supabase db reset    # Drops and recreates from all migrations

# Production (linked project)
npx supabase db push     # Applies pending migrations
```

### Migration Checklist

Copy this checklist and track progress:
- [ ] Create migration file: `npx supabase migration new <name>`
- [ ] Write SQL (tables, indexes, constraints)
- [ ] Add RLS: `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
- [ ] Add RLS policies for each table
- [ ] Add `updated_at` trigger for each table
- [ ] Test locally: `npx supabase db reset`
- [ ] Regenerate types: `npx supabase gen types typescript --local > types/database.ts`
- [ ] Verify types compile: `npm run build`

### WARNING: Editing Existing Migrations After They're Applied

**The Problem:**

```bash
# BAD - Editing a migration that's already been applied to production
vim supabase/migrations/20250130_initial_schema.sql  # modifying existing file
```

**Why This Breaks:** Supabase tracks applied migrations by filename. Editing an already-applied migration has no effect on existing databases and creates schema drift between environments.

**The Fix:** Always create a new migration for changes:

```bash
npx supabase migration new add_budget_column
```

```sql
-- supabase/migrations/<timestamp>_add_budget_column.sql
ALTER TABLE organizations ADD COLUMN budget DECIMAL(12,2);
```

---

## Type Generation

```bash
# From local database
npx supabase gen types typescript --local > types/database.ts

# From remote project
npx supabase gen types typescript --project-id <project-id> > types/database.ts
```

### Feedback Loop

1. Modify migration SQL
2. Apply: `npx supabase db reset`
3. Regenerate: `npx supabase gen types typescript --local > types/database.ts`
4. Verify: `npm run build`
5. If build fails, fix type errors and repeat from step 4

Use the generated `Database` type as a generic parameter on both clients:

```typescript
import type { Database } from '@/types/database'

// Typed helpers for convenience
type Tables = Database['public']['Tables']
type Organization = Tables['organizations']['Row']
type OrganizationInsert = Tables['organizations']['Insert']
type Transaction = Tables['transactions']['Row']
```

See the **typescript** skill for organizing type exports.

---

## Auth Flow Implementation

### Sign Up (Registration)

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const supabase = await createClient()
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const name = formData.get('name') as string

  const { data, error } = await supabase.auth.signUp({ email, password })
  if (error) throw new Error(error.message)

  // Create treasurer profile linked to auth user
  await supabase
    .from('treasurers')
    .insert({ id: data.user!.id, name })

  redirect('/organizations')
}
```

### Sign In

```typescript
'use server'

export async function signIn(formData: FormData) {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({
    email: formData.get('email') as string,
    password: formData.get('password') as string,
  })
  if (error) throw new Error(error.message)
  redirect('/organizations')
}
```

### Sign Out

```typescript
'use server'

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
```

### Route Protection in Middleware

```typescript
// middleware.ts
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
```

Add redirect logic inside `updateSession` (see patterns reference) to send unauthenticated users to `/login`.

---

## Server Action CRUD Pattern

Every mutation follows the same structure. See the **zod** skill for validation schemas.

```typescript
'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateTransaction(id: string, formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  // RLS handles authorization—no manual org ownership check needed
  const { error } = await supabase
    .from('transactions')
    .update({
      description: formData.get('description') as string,
      amount: Number(formData.get('amount')),
    })
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/organizations/[orgId]/transactions', 'page')
}
```

Key points:
- Always call `getUser()` first to verify authentication
- RLS policies enforce authorization—no need for manual ownership checks in application code
- Call `revalidatePath` after mutations to refresh cached Server Component data
- See the **nextjs** skill for `revalidatePath` and `revalidateTag` patterns

---

## Deployment Checklist

Copy this checklist and track progress:
- [ ] Create Supabase project at supabase.com
- [ ] Link local project: `npx supabase link --project-ref <ref>`
- [ ] Push migrations: `npx supabase db push`
- [ ] Set env vars in Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Configure Supabase Auth redirect URLs (add production domain)
- [ ] Verify RLS policies are active: `SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public'`
- [ ] Regenerate types from remote: `npx supabase gen types typescript --project-id <id> > types/database.ts`
- [ ] Run production build: `npm run build`
- [ ] Smoke test auth flow on production URL
