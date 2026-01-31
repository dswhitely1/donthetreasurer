---
name: nextjs
description: |
  Builds App Router applications with Server Actions, API Routes, and Next.js-specific patterns.
  Use when: creating pages with route groups, implementing Server Actions for mutations, creating API Routes for non-HTML responses (Excel export), setting up layouts and loading states, or configuring Supabase middleware.
allowed-tools: Read, Edit, Write, Glob, Grep, Bash, mcp__context7__resolve-library-id, mcp__context7__query-docs
---

# Next.js Skill

This project uses Next.js 16 App Router with two route groups: `(auth)` for public pages and `(dashboard)` for protected pages. Server Components are the default. Server Actions handle mutations. API Routes handle non-HTML responses (Excel export). Supabase middleware refreshes auth sessions.

## Quick Start

### Server Component Page (default)

```tsx
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

### Server Action with Zod Validation

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

### API Route (Excel export)

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

  // Build Excel with ExcelJS (see the **exceljs** skill)
  const buffer = await generateExcelReport(/* ... */);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="report.xlsx"`,
    },
  });
}
```

## Key Concepts

| Concept | Pattern |
|---------|---------|
| `params` in Next.js 16 | `Promise` type — always `await params` |
| Server Component | Default — fetches data with `await`, no `"use client"` |
| Client Component | Add `"use client"` only for hooks, events, browser APIs |
| Server Action | `"use server"` file, validate with Zod, call `revalidatePath` |
| API Route | `route.ts` — only for non-HTML responses (Excel, webhooks) |
| Loading state | `loading.tsx` sibling for Suspense boundary |
| Error boundary | `error.tsx` sibling with `"use client"` |

## See Also

- [patterns](references/patterns.md) — Route organization, Server vs Client components, anti-patterns
- [workflows](references/workflows.md) — Page/action/route checklists, middleware setup, common build errors

## Related Skills

- See the **zod** skill for validation schemas
- See the **supabase** skill for client setup and RLS
- See the **react** skill for component patterns
- See the **typescript** skill for strict mode and type safety

## Documentation Resources

> Fetch latest Next.js documentation with Context7.

**How to use Context7:**
1. Use `mcp__context7__resolve-library-id` to search for "next.js"
2. **Prefer website documentation** (IDs starting with `/websites/`) over source code repositories
3. Query with `mcp__context7__query-docs` using the resolved library ID

**Recommended Queries:**
- "Next.js App Router Server Components data fetching"
- "Next.js Server Actions form validation"
- "Next.js API Routes file download response"
- "Next.js middleware authentication redirect"
