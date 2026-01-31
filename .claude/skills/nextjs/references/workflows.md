# Next.js Development Workflows

## Contents
- Adding a New Page
- Adding a Server Action
- Adding an API Route
- Supabase Middleware Setup
- Build and Lint Validation
- Common Build Errors

---

## Adding a New Page

### Checklist

Copy this checklist and track progress:
- [ ] Step 1: Create `page.tsx` in the correct route directory
- [ ] Step 2: Add `loading.tsx` for async data fetching pages
- [ ] Step 3: Add `error.tsx` for error boundary (if needed)
- [ ] Step 4: Update layout if new navigation items are needed
- [ ] Step 5: Run `npm run build` to verify no type errors

### Example: Transaction List Page

```tsx
// app/(dashboard)/organizations/[orgId]/transactions/page.tsx
import { createClient } from "@/lib/supabase/server";
import { TransactionsTable } from "@/components/tables/transactions-table";

interface PageProps {
  params: Promise<{ orgId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function TransactionsPage({ params, searchParams }: PageProps) {
  const { orgId } = await params;
  const filters = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("transactions")
    .select("*, transaction_line_items(*, categories(*))")
    .eq("account_id", orgId)
    .order("transaction_date", { ascending: false });

  if (filters.status) {
    query = query.eq("status", filters.status as string);
  }

  const { data: transactions } = await query;
  return <TransactionsTable data={transactions ?? []} orgId={orgId} />;
}
```

**Key points:**
- `params` and `searchParams` are `Promise` types in Next.js 16 — always `await` them
- Use the server Supabase client (`@/lib/supabase/server`) in Server Components
- RLS policies handle authorization — no manual auth checks needed in queries

---

## Adding a Server Action

### Checklist

Copy this checklist and track progress:
- [ ] Step 1: Create action file in `app/actions/` with `"use server"` directive
- [ ] Step 2: Define **zod** schema for validation (see the **zod** skill)
- [ ] Step 3: Implement the action function
- [ ] Step 4: Call `revalidatePath()` after successful mutation
- [ ] Step 5: Return typed error state for the UI to consume
- [ ] Step 6: Wire up in a Client Component via `useActionState` or `<form action={...}>`

### Action File Pattern

```ts
// app/actions/account.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const ACCOUNT_TYPES = ["checking", "savings", "paypal", "cash", "other"] as const;

const CreateAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  account_type: z.enum(ACCOUNT_TYPES),
  description: z.string().max(500).optional(),
  opening_balance: z.coerce.number().min(0).default(0),
});

type ActionState = {
  errors?: Record<string, string[]>;
  error?: string;
} | null;

export async function createAccount(
  orgId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const parsed = CreateAccountSchema.safeParse({
    name: formData.get("name"),
    account_type: formData.get("account_type"),
    description: formData.get("description"),
    opening_balance: formData.get("opening_balance"),
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("accounts")
    .insert({ ...parsed.data, organization_id: orgId });

  if (error) return { error: error.message };

  revalidatePath(`/organizations/${orgId}/accounts`);
  return null;
}
```

### Client Component Consuming the Action

```tsx
// components/forms/account-form.tsx
"use client";

import { useActionState } from "react";
import { createAccount } from "@/app/actions/account";

export function AccountForm({ orgId }: Readonly<{ orgId: string }>) {
  const createAccountWithOrg = createAccount.bind(null, orgId);
  const [state, formAction, pending] = useActionState(createAccountWithOrg, null);

  return (
    <form action={formAction}>
      <input name="name" required />
      {state?.errors?.name && <p className="text-red-500 text-sm">{state.errors.name[0]}</p>}

      <select name="account_type" required>
        <option value="checking">Checking</option>
        <option value="savings">Savings</option>
        <option value="paypal">PayPal</option>
        <option value="cash">Cash</option>
        <option value="other">Other</option>
      </select>

      <button type="submit" disabled={pending}>
        {pending ? "Creating..." : "Create Account"}
      </button>
    </form>
  );
}
```

---

## Adding an API Route

Only use API Routes for non-HTML responses (file downloads, webhooks). For data mutations, use Server Actions.

```ts
// app/api/reports/export/route.ts
import { type NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  // 1. Authenticate
  // 2. Validate query params
  // 3. Fetch data
  // 4. Generate response (Excel, CSV, PDF)
  // 5. Return with appropriate Content-Type
}
```

NEVER create API Routes for CRUD operations that Server Actions handle.

---

## Supabase Middleware Setup

Middleware refreshes the Supabase auth session on every request and redirects unauthenticated users away from `(dashboard)` routes.

```ts
// middleware.ts (project root)
import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user && request.nextUrl.pathname.startsWith("/organizations")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

---

## Build and Lint Validation

### Iterate-Until-Pass Pattern

1. Make changes
2. Validate: `npm run lint && npm run build`
3. If validation fails, fix issues and repeat step 2
4. Only proceed when both lint and build pass

```bash
# Development
npm run dev          # Hot reload at localhost:3000

# Validation
npm run lint         # ESLint with next/core-web-vitals + typescript
npm run build        # Full production build — catches type errors, missing imports

# Production test
npm run build && npm start
```

---

## Common Build Errors

### `params` Not Awaited

Next.js 16 changed `params` and `searchParams` to `Promise` types.

```tsx
// BAD - Destructuring directly (Next.js 14/15 pattern)
export default function Page({ params: { orgId } }) { ... }

// GOOD - Await the promise (Next.js 16)
export default async function Page({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
}
```

### Server/Client Import Boundary

```
Error: Module "@/lib/supabase/server" cannot be imported from a Client Component.
```

Use `@/lib/supabase/client` in `"use client"` files. Use `@/lib/supabase/server` only in Server Components, Server Actions, and API Routes.

### Missing `"use client"` Directive

```
Error: useState only works in Client Components. Add "use client" directive.
```

Any file using hooks (`useState`, `useEffect`, `useActionState`, `useRef`) or event handlers must start with `"use client"`.

### Metadata Export in Client Components

```
Error: metadata export is not allowed in Client Components.
```

Export `metadata` only from Server Component pages or `layout.tsx`. If a page needs interactivity, keep it as a Server Component and extract the interactive part into a separate Client Component.
