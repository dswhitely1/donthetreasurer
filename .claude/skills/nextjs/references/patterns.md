# Next.js App Router Patterns

## Contents
- Route Organization
- Server Components vs Client Components
- Server Actions for Mutations
- API Routes for Non-HTML Responses
- Layouts and Loading States
- Anti-Patterns

---

## Route Organization

This project uses two route groups matching the PRD structure:

```
app/
├── (auth)/           # Public: login, register
│   ├── login/page.tsx
│   └── register/page.tsx
├── (dashboard)/      # Protected: requires auth
│   ├── layout.tsx    # Auth check, sidebar, org-switcher
│   ├── page.tsx      # Dashboard home
│   └── organizations/
│       └── [orgId]/
│           ├── transactions/page.tsx
│           └── reports/page.tsx
├── api/
│   └── reports/export/route.ts
├── layout.tsx        # Root: fonts, global providers
└── globals.css
```

Route groups `(auth)` and `(dashboard)` share the root layout but have independent layouts. The parentheses keep group names out of the URL.

---

## Server Components vs Client Components

**Default to Server Components.** Only add `"use client"` when you need browser APIs, event handlers, hooks, or third-party client libraries.

```tsx
// GOOD - Server Component (default), fetches data directly
// app/(dashboard)/organizations/[orgId]/accounts/page.tsx
import { createClient } from "@/lib/supabase/server";
import { AccountList } from "@/components/tables/account-list";

export default async function AccountsPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data: accounts } = await supabase
    .from("accounts")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true);

  return <AccountList accounts={accounts ?? []} orgId={orgId} />;
}
```

```tsx
// GOOD - Client Component only where interactivity is needed
// components/forms/transaction-form.tsx
"use client";

import { useActionState } from "react";
import { createTransaction } from "@/app/actions/transaction";

export function TransactionForm({ orgId }: Readonly<{ orgId: string }>) {
  const [state, formAction, pending] = useActionState(createTransaction, null);

  return (
    <form action={formAction}>
      <input type="hidden" name="orgId" value={orgId} />
      {/* form fields */}
      <button type="submit" disabled={pending}>Save</button>
    </form>
  );
}
```

### WARNING: Fetching Data in Client Components with useEffect

**The Problem:**

```tsx
// BAD - useEffect data fetching in Client Component
"use client";
export function TransactionList({ orgId }: { orgId: string }) {
  const [transactions, setTransactions] = useState([]);
  useEffect(() => {
    fetch(`/api/organizations/${orgId}/transactions`)
      .then((r) => r.json())
      .then(setTransactions);
  }, [orgId]);
  return <Table data={transactions} />;
}
```

**Why This Breaks:**
1. Race conditions when `orgId` changes rapidly (org switcher)
2. No loading/error states without significant boilerplate
3. No caching — every mount re-fetches identical data
4. Waterfalls — nested components fetch sequentially

**The Fix:** Use a Server Component to fetch, or install `@tanstack/react-query` (see the **tanstack-query** skill).

```tsx
// GOOD - Server Component fetches, Client Component renders
// app/(dashboard)/organizations/[orgId]/transactions/page.tsx
export default async function TransactionsPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("*, transaction_line_items(*)")
    .eq("account_id", orgId);

  return <TransactionsTable data={data ?? []} />;
}
```

---

## Server Actions for Mutations

Place Server Actions in dedicated files under `app/actions/`. Use `"use server"` at the file top. Validate with **zod** (see the **zod** skill).

```ts
// app/actions/category.ts
"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const CategorySchema = z.object({
  name: z.string().min(1).max(100),
  category_type: z.enum(["income", "expense"]),
  parent_id: z.string().uuid().nullable(),
});

export async function createCategory(orgId: string, formData: FormData) {
  const parsed = CategorySchema.safeParse({
    name: formData.get("name"),
    category_type: formData.get("category_type"),
    parent_id: formData.get("parent_id") || null,
  });

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .insert({ ...parsed.data, organization_id: orgId });

  if (error) return { error: error.message };
  revalidatePath(`/organizations/${orgId}/categories`);
}
```

### WARNING: Mutations During Rendering

**The Problem:**

```tsx
// BAD - Mutation in a Server Component's render path
export default async function Page({ searchParams }: { searchParams: Promise<URLSearchParams> }) {
  const params = await searchParams;
  if (params.get("archive")) {
    await supabase.from("organizations").update({ is_active: false });
  }
  return <div>...</div>;
}
```

**Why This Breaks:** Server Components can re-render on navigation, prefetch, or revalidation. A mutation here fires on every render, not just user intent. GET requests should never mutate state.

**The Fix:** Always use Server Actions invoked by `<form>` or `startTransition`.

---

## API Routes for Non-HTML Responses

Use API Routes (`route.ts`) only for responses that aren't HTML: file downloads, webhooks, programmatic JSON APIs. This project needs one for Excel export.

```ts
// app/api/reports/export/route.ts
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const orgId = request.nextUrl.searchParams.get("org_id");
  const startDate = request.nextUrl.searchParams.get("start_date");
  const endDate = request.nextUrl.searchParams.get("end_date");

  if (!orgId || !startDate || !endDate) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  // Build Excel with ExcelJS (see the **exceljs** skill)
  const buffer = await generateExcelReport(orgId, startDate, endDate);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report.xlsx"`,
    },
  });
}
```

---

## Layouts and Loading States

### Dashboard Layout with Auth Guard

```tsx
// app/(dashboard)/layout.tsx
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

### Loading UI

```tsx
// app/(dashboard)/organizations/[orgId]/transactions/loading.tsx
export default function Loading() {
  return <div className="animate-pulse space-y-4">
    <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
    <div className="h-64 rounded bg-zinc-200 dark:bg-zinc-800" />
  </div>;
}
```

---

## Anti-Patterns

### WARNING: `"use client"` on Page Components

Marking a page `"use client"` forces the entire subtree to the client. Keep pages as Server Components and push interactivity to leaf components.

### WARNING: Importing Server-Only Code in Client Components

```ts
// BAD - importing server utility in a "use client" file
"use client";
import { createClient } from "@/lib/supabase/server"; // Breaks at build
```

**The Fix:** Pass data as props from a Server Component parent, or use `@/lib/supabase/client` for the browser Supabase client.

### WARNING: Missing `revalidatePath` After Mutations

Forgetting to call `revalidatePath` or `revalidateTag` after a Server Action means stale data persists in the cache. Always revalidate the affected route.
